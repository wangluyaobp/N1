import { useEffect, useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { parseCsv } from "../csv";
import { deleteTagAndCards, putCards, putCard, putTag } from "../db";
import { Toast } from "./Toast";
import { EditCard } from "./EditCard";

// ✅ 云端同步：新增
import {
  cloudUpsertTag,
  cloudSoftDeleteTag,
  cloudUpsertCard,
  cloudSoftDeleteCard,
} from "../cloud";

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const countByTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of props.cards) m.set(c.tagId, (m.get(c.tagId) ?? 0) + 1);
    return m;
  }, [props.cards]);

  // ✅ 这里用 null 表示“未选中任何标签”（不显示下方列表）
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

      // 1) 本地保存
      await putTag(tag);
      await putCards(cards);

      // 2) ✅ 云端保存（已登录才会成功；未登录就跳过）
      try {
        await cloudUpsertTag(tag);
        for (const c of cards) {
          await cloudUpsertCard(c);
        }
        setToast(`导入成功：${cards.length} 张（已上传云端）`);
      } catch (e) {
        // 没登录/网络问题等：不影响本地使用
        setToast(`导入成功：${cards.length} 张（未上传云端）`);
        console.warn("cloud upload skipped/failed:", e);
      }

      await props.onRefresh();
      props.setActiveTagId(tagId); // 导入后自动选中该标签
      setEditing(null);
    } catch (e: any) {
      setToast(`导入失败：${e?.message ?? "未知错误"}`);
    }
  }

  async function rename(tag: BatchTag) {
    const name = prompt("请输入新的标签名：", tag.name);
    if (!name) return;

    const newTag = { ...tag, name: name.trim() };

    // 1) 本地更新
    await putTag(newTag);

    // 2) ✅ 云端更新（失败不影响本地）
    try {
      await cloudUpsertTag(newTag);
      setToast("已修改标签名（已同步云端）");
    } catch (e) {
      setToast("已修改标签名（未同步云端）");
      console.warn("cloud rename skipped/failed:", e);
    }

    await props.onRefresh();
  }

  async function remove(tag: BatchTag) {
    const ok = confirm(`确定删除标签「${tag.name}」以及其下全部卡片吗？此操作不可撤销。`);
    if (!ok) return;

    // 如果正在选中这个标签，删除前先取消选中
    if (props.activeTagId === tag.id) {
      props.setActiveTagId("ALL");
      setEditing(null);
    }

    // 1) 本地删除
    await deleteTagAndCards(tag.id);

    // 2) ✅ 云端软删除 tag + 软删除其下 cards（失败不影响本地）
    try {
      await cloudSoftDeleteTag(tag.id);

      // 把该标签下的卡片也标记 deleted，确保其他设备同步后会消失
      const cardsToDelete = props.cards.filter((c) => c.tagId === tag.id);
      for (const c of cardsToDelete) {
        await cloudSoftDeleteCard(c.id);
      }

      setToast("已删除标签及其卡片（已同步云端）");
    } catch (e) {
      setToast("已删除标签及其卡片（未同步云端）");
      console.warn("cloud delete skipped/failed:", e);
    }

    await props.onRefresh();
  }

  async function saveEdit(card: AnyCard) {
    // 1) 本地保存
    await putCard(card);

    // 2) ✅ 云端保存（失败不影响本地）
    try {
      await cloudUpsertCard(card);
      setToast("已保存（已同步云端）");
    } catch (e) {
      setToast("已保存（未同步云端）");
      console.warn("cloud save skipped/failed:", e);
    }

    setEditing(null);
    await props.onRefresh();
  }

  // ✅ 点击标签卡片：未选中 -> 选中；已选中 -> 取消选中（不显示下方列表）
  function toggleSelect(tagId: string) {
    if (props.activeTagId === tagId) {
      props.setActiveTagId("ALL"); // 用 ALL 表示“未选中任何标签”
      setEditing(null);
    } else {
      props.setActiveTagId(tagId);
      setEditing(null);
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
      <div className="row">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onImport(e.target.files?.[0])} />
        <button
          className="btn"
          onClick={() => {
            props.setActiveTagId("ALL"); // 取消选中
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

      {/* 标签卡片：只有选中的那个显示角标，其余完全不显示 */}
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
              {/* ✅ 只有当前选中才显示角标 */}
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

              {/* ✅ 按钮点击不要触发整卡片的选中切换 */}
              <div className="row" onClick={(e) => e.stopPropagation()}>
                <button className="btn" onClick={() => rename(t)}>改名</button>
                <button className="btn danger" onClick={() => remove(t)}>删除整批</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ 选中标签才显示下方列表；取消选中则完全不显示 */}
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
                    <button className="btn" onClick={() => setEditing(c)}>编辑</button>
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
