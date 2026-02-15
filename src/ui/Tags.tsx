import { useEffect, useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { parseCsv } from "../csv";
import { deleteTagAndCards, putCards, putCard, putTag } from "../db";
import { Toast } from "./Toast";
import { EditCard } from "./EditCard";

import { supabase } from "../supabase";
import { cloudUpsertTags, cloudUpsertCards } from "../cloud";
import { syncFromCloud } from "../sync";

// ✅ 本地/云端同步状态：localStorage keys
const dirtyKey = (type: DeckType) => `srs_dirty_${type}`;
const lastPushKey = (type: DeckType) => `srs_last_push_${type}`;
const lastPullKey = (type: DeckType) => `srs_last_pull_${type}`;

function markDirty(type: DeckType) {
  localStorage.setItem(dirtyKey(type), "1");
}
function clearDirty(type: DeckType) {
  localStorage.removeItem(dirtyKey(type));
}
function setLastPush(type: DeckType) {
  localStorage.setItem(lastPushKey(type), String(Date.now()));
}
function setLastPull(type: DeckType) {
  localStorage.setItem(lastPullKey(type), String(Date.now()));
}
function fmt(ts?: number | null) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

export function Tags(props: {
  type: DeckType;
  tags: BatchTag[];
  cards: AnyCard[];
  onRefresh: () => Promise<void>;
  activeTagId: string | "ALL";
  setActiveTagId: (id: string | "ALL") => void;
}) {
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<AnyCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  // ✅ 用来触发“状态小字”重算
  const [statusTick, setStatusTick] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // ✅ 读取登录状态
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      setSessionEmail(data.session?.user.email ?? null);
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setStatusTick((x) => x + 1);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const countByTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of props.cards) m.set(c.tagId, (m.get(c.tagId) ?? 0) + 1);
    return m;
  }, [props.cards]);

  const selectedTag = useMemo(() => {
    if (props.activeTagId === "ALL") return null;
    return props.tags.find((t) => t.id === props.activeTagId) ?? null;
  }, [props.activeTagId, props.tags]);

  const cardsInSelectedTag = useMemo(() => {
    if (!selectedTag) return [];
    return props.cards.filter((c) => c.tagId === selectedTag.id);
  }, [props.cards, selectedTag]);

  // ✅ 云端状态小字（已同步 / 未上传）
  const syncHint = useMemo(() => {
    const dirty = localStorage.getItem(dirtyKey(props.type)) === "1";
    const lp = Number(localStorage.getItem(lastPushKey(props.type)) || "0");
    const ll = Number(localStorage.getItem(lastPullKey(props.type)) || "0");

    if (!sessionEmail) {
      return `未登录｜本地数据：IndexedDB（状态：${dirty ? "有本地改动未上传" : "未检测到未上传改动"}）｜上次上传：${fmt(lp)}｜上次导入：${fmt(ll)}`;
    }
    return `${dirty ? "⚠️ 本地有未上传改动" : "✅ 当前看起来已与云端同步"}｜上次上传：${fmt(lp)}｜上次导入：${fmt(ll)}`;
  }, [props.type, sessionEmail, statusTick]);

  async function onImport(file?: File | null) {
    if (!file) return;
    try {
      const { tagId, tagName, cards } = await parseCsv(file, props.type);
      const tag: BatchTag = { id: tagId, type: props.type, name: tagName, createdAt: Date.now() };
      await putTag(tag);
      await putCards(cards);

      markDirty(props.type);
      setStatusTick((x) => x + 1);

      await props.onRefresh();
      props.setActiveTagId(tagId);
      setEditing(null);
      setToast(`导入成功：${cards.length} 张（标签：${tagName}）`);
    } catch (e: any) {
      setToast(`导入失败：${e?.message ?? "未知错误"}`);
    }
  }

  async function rename(tag: BatchTag) {
    const name = prompt("请输入新的标签名：", tag.name);
    if (!name) return;
    await putTag({ ...tag, name: name.trim() });

    markDirty(props.type);
    setStatusTick((x) => x + 1);

    await props.onRefresh();
    setToast("已修改标签名");
  }

  async function remove(tag: BatchTag) {
    const ok = confirm(`确定删除标签「${tag.name}」以及其下全部卡片吗？此操作不可撤销。`);
    if (!ok) return;

    if (props.activeTagId === tag.id) {
      props.setActiveTagId("ALL");
      setEditing(null);
    }

    await deleteTagAndCards(tag.id);

    markDirty(props.type);
    setStatusTick((x) => x + 1);

    await props.onRefresh();
    setToast("已删除标签及其卡片");
  }

  async function saveEdit(card: AnyCard) {
    await putCard(card);
    setEditing(null);

    markDirty(props.type);
    setStatusTick((x) => x + 1);

    await props.onRefresh();
    setToast("已保存");
  }

  function toggleSelect(tagId: string) {
    if (props.activeTagId === tagId) {
      props.setActiveTagId("ALL");
      setEditing(null);
    } else {
      props.setActiveTagId(tagId);
      setEditing(null);
    }
  }

  // ✅ 上传（本机→云端）
  async function pushLocalToCloud() {
    if (!sessionEmail) {
      setToast("请先在首页登录，再进行云同步。");
      return;
    }
    setBusy(true);
    try {
      const localTags = props.tags.filter((t) => t.type === props.type);
      const localCards = props.cards.filter((c) => c.type === props.type);

      if (localTags.length > 0) await cloudUpsertTags(localTags);
      if (localCards.length > 0) await cloudUpsertCards(localCards);

      clearDirty(props.type);
      setLastPush(props.type);
      setStatusTick((x) => x + 1);

      setToast(`上传完成：标签 ${localTags.length} 个，卡片 ${localCards.length} 张（本机→云端）`);
    } catch (e: any) {
      setToast(`上传失败：${e?.message ?? "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  // ✅ 导入（云端→本机）
  async function pullCloudToLocal() {
    if (!sessionEmail) {
      setToast("请先在首页登录，再进行云同步。");
      return;
    }
    setBusy(true);
    try {
      await syncFromCloud(props.type);
      await props.onRefresh();

      clearDirty(props.type);
      setLastPull(props.type);
      setStatusTick((x) => x + 1);

      setToast("导入完成：已从云端拉取最新数据（云端→本机）");
    } catch (e: any) {
      setToast(`导入失败：${e?.message ?? "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>标签（批次）</h3>

      {/* ✅ 你要的：显示在“标签（批次）”下面的小字 */}
      <div className="muted">{syncHint}</div>

      <div className="space" />

      <div className="muted">
        固定 CSV 表头：
        {props.type === "vocab"
          ? " 分类,单词,读音（音调+假名）,词性,意思"
          : " 文法,接续,意思,使用特性,例句"}
      </div>

      <div className="space" />

      {/* ✅ 上传/导入按钮 */}
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <button className="btn primary" onClick={pushLocalToCloud} disabled={busy || !sessionEmail}>
          上传（本机→云端）
        </button>
        <button className="btn" onClick={pullCloudToLocal} disabled={busy || !sessionEmail}>
          导入（云端→本机）
        </button>
        <div className="muted" style={{ marginLeft: 8 }}>
          {sessionEmail ? `当前账号：${sessionEmail}` : "未登录：请先在首页登录"}
        </div>
      </div>

      <div className="space" />

      {/* ✅ 只保留文件导入，不要“查看全部” */}
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onImport(e.target.files?.[0])} />
      </div>

      <div className="space" />
      <hr />

      {props.tags.length === 0 && <div className="muted">还没有标签。先导入 CSV 吧。</div>}

      <div className="space" />

      {/* ✅ 改成“一行一个”的标签列表（手机更好看） */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {props.tags.map((t) => {
          const isSelected = props.activeTagId === t.id;

          return (
            <div
              key={t.id}
              className="card"
              style={{
                padding: 12,
                position: "relative",
                cursor: "pointer",
                outline: isSelected ? "2px solid #3a7afe" : "none",
              }}
              onClick={() => toggleSelect(t.id)}
              title={isSelected ? "再次点击取消选中" : "点击选中"}
            >
              {/* ✅ 选中角标保留（更小一点，不挡内容） */}
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#fff",
                    color: "#000",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  已选中
                </div>
              )}

              {/* ✅ 单行布局：左信息，右按钮（按钮永远靠右，不掉下面） */}
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "nowrap",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</div>
                  <div className="muted">{countByTag.get(t.id) ?? 0} 张</div>
                </div>

                {/* ✅ 按钮区域固定在右侧 */}
                <div
                  className="row"
                  style={{ gap: 10, flexShrink: 0, flexWrap: "nowrap" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="btn" onClick={() => rename(t)}>
                    改名
                  </button>
                  <button className="btn danger" onClick={() => remove(t)}>
                    删除整批
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ 选中标签才显示下方列表；取消选中则不显示 */}
      {selectedTag && (
        <>
          <div className="space" />
          <hr />
          <div className="space" />

          <div className="muted">这里筛选后可直接编辑对应（单词/文法都支持）。</div>
          <div className="space" />

          {cardsInSelectedTag.length === 0 ? (
            <div className="muted">该标签下还没有卡片。</div>
          ) : (
            cardsInSelectedTag.map((c) => (
              <div key={c.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{c.front}</div>
                    <div className="muted">
                      到期：{c.srs.dueAt === 0 ? " 新卡" : new Date(c.srs.dueAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="row" style={{ flexShrink: 0 }}>
                    <button className="btn" onClick={() => setEditing(c)}>
                      编辑
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {editing && (
            <>
              <div className="space" />
              <EditCard
                type={props.type}
                initial={editing}
                tagId={editing.tagId}
                onSave={saveEdit}
                onCancel={() => setEditing(null)}
              />
            </>
          )}
        </>
      )}

      <Toast text={toast} />
    </div>
  );
}
