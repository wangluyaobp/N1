import { useEffect, useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { parseCsv } from "../csv";
import { deleteTagAndCards, putCards, putCard, putTag } from "../db";
import { Toast } from "./Toast";
import { EditCard } from "./EditCard";

// ✅ 云端同步：读取登录状态 + 批量 upsert + 云端拉取
import { supabase } from "../supabase";
import { cloudUpsertTags, cloudUpsertCards } from "../cloud";
import { syncFromCloud } from "../sync";

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // ✅ 读取登录状态（用于启用/禁用 上传/导入 按钮）
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      setSessionEmail(data.session?.user.email ?? null);
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const countByTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of props.cards) m.set(c.tagId, (m.get(c.tagId) ?? 0) + 1);
    return m;
  }, [props.cards]);

  // ✅ null 表示“未选中任何标签”（不显示下方列表）
  const selectedTag = useMemo(() => {
    if (props.activeTagId === "ALL") return null;
    return props.tags.find((t) => t.id === props.activeTagId) ?? null;
  }, [props.activeTagId, props.tags]);

  const cardsInSelectedTag = useMemo(() => {
    if (!selectedTag) return [];
    return props.cards.filter((c) => c.tagId === selectedTag.id);
  }, [props.cards, selectedTag]);

  async function onImport(file?: File | null) {
    if (!file) return;
    try {
      const { tagId, tagName, cards } = await parseCsv(file, props.type);
      const tag: BatchTag = { id: tagId, type: props.type, name: tagName, createdAt: Date.now() };
      await putTag(tag);
      await putCards(cards);
      await props.onRefresh();
      props.setActiveTagId(tagId); // 导入后自动选中该标签
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
    await props.onRefresh();
    setToast("已删除标签及其卡片");
  }

  async function saveEdit(card: AnyCard) {
    await putCard(card);
    setEditing(null);
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

  // ✅ 上传（本机→云端）：批量 upsert（更快、更稳定）
  async function pushLocalToCloud() {
    if (!sessionEmail) {
      setToast("请先在首页登录，再进行云同步。");
      return;
    }
    setBusy(true);
    try {
      const localTags = props.tags.filter((t) => t.type === props.type);
      const localCards = props.cards.filter((c) => c.type === props.type);

      // 先推 tags 再推 cards（避免云端出现孤儿卡片）
      if (localTags.length > 0) await cloudUpsertTags(localTags);
      if (localCards.length > 0) await cloudUpsertCards(localCards);

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

      <div className="muted">
        固定 CSV 表头：
        {props.type === "vocab"
          ? " 分类,单词,读音（音调+假名）,词性,意思"
          : " 文法,接续,意思,使用特性,例句"}
      </div>

      <div className="space" />

      {/* ✅ 两按钮夹在“云同步状态”下面 */}
      <div className="row">
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

      <div className="row">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onImport(e.target.files?.[0])} />
        <button
          className="btn"
          onClick={() => {
            props.setActiveTagId("ALL");
            setEditing(null);
          }}
        >
          查看全部（{props.cards.length}）
        </button>
      </div>

      <div className="space" />
      <hr />

      {props.tags.length === 0 && <div className="muted">还没有标签。先导入 CSV 吧。</div>}

      <div className="space" />

      <div className="row">
        {props.tags.map((t) => {
          const isSelected = props.activeTagId === t.id;

          return (
            <div
              key={t.id}
              className="card"
              style={{
                padding: 12,
                minWidth: 260,
                position: "relative",
                cursor: "pointer",
                outline: isSelected ? "2px solid #3a7afe" : "none",
              }}
              onClick={() => toggleSelect(t.id)}
              title={isSelected ? "再次点击取消选中" : "点击选中"}
            >
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    padding: "6px 10px",
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

              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div className="muted">{countByTag.get(t.id) ?? 0} 张</div>
                </div>
              </div>

              <div className="space" />

              <div className="row" onClick={(e) => e.stopPropagation()}>
                <button className="btn" onClick={() => rename(t)}>
                  改名
                </button>
                <button className="btn danger" onClick={() => remove(t)}>
                  删除整批
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{c.front}</div>
                    <div className="muted">
                      到期：{c.srs.dueAt === 0 ? " 新卡" : new Date(c.srs.dueAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="row">
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
