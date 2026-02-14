import { useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { deleteCard, putCard } from "../db";
import { EditCard } from "./EditCard";
import { Toast } from "./Toast";

export function Cards(props: {
  type: DeckType;
  tags: BatchTag[];
  cards: AnyCard[]; // 注意：这里收到的 cards 已经是 Module 里按 activeTagId 过滤过的
  onRefresh: () => Promise<void>;
  activeTagId: string | "ALL";                  // ✅ 新增
  setActiveTagId: (id: string | "ALL") => void; // ✅ 新增
}) {
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<AnyCard | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  // “新增卡”选择放到哪个标签
  const [createTagId, setCreateTagId] = useState<string>("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return props.cards;
    return props.cards.filter((c) => JSON.stringify(c).toLowerCase().includes(s));
  }, [props.cards, q]);

  async function save(card: AnyCard) {
    await putCard(card);
    setEditing(null);
    setCreating(false);
    await props.onRefresh();
    setToast("已保存");
    setTimeout(() => setToast(""), 1200);
  }

  async function remove(id: string) {
    const ok = confirm("确定删除这张卡片吗？");
    if (!ok) return;
    await deleteCard(id);
    await props.onRefresh();
    setToast("已删除");
    setTimeout(() => setToast(""), 1200);
  }

  const canCreate = props.tags.length > 0;
  const tagIdForCreate = createTagId || props.tags[0]?.id || "";

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>配合管理</h3>

      {/* ✅ 新增：筛选标签（影响下面列表显示） */}
      <div className="row">
        <select value={props.activeTagId} onChange={(e) => props.setActiveTagId(e.target.value as any)}>
          <option value="ALL">（筛选：全部标签）</option>
          {props.tags.map((t) => (
            <option key={t.id} value={t.id}>（筛选）{t.name}</option>
          ))}
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索（单词/读音/意思/例句…）"
          style={{ minWidth: 260 }}
        />

        {/* 新增卡：选择标签 */}
        <select value={createTagId} onChange={(e) => setCreateTagId(e.target.value)}>
          <option value="">（新增卡：默认第一个标签）</option>
          {props.tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          className="btn primary"
          onClick={() => {
            if (!canCreate) {
              alert("请先导入 CSV 生成一个标签批次。");
              return;
            }
            setCreating(true);
            setEditing(null);
          }}
        >
          + 新增补充
        </button>
      </div>

      <div className="space" />
      <div className="muted">
        当前显示：{filtered.length} 张（筛选：{props.activeTagId === "ALL" ? "全部" : "已选标签"}）
      </div>
      <div className="space" />

      {(creating || editing) && (
        <EditCard
          type={props.type}
          initial={editing ?? undefined}
          tagId={editing?.tagId ?? tagIdForCreate}
          onSave={save}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <div className="space" />
      <hr />

      {filtered.map((c) => (
        <div key={c.id} className="card" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{c.front}</div>
              <div className="muted">
                标签：{props.tags.find((t) => t.id === c.tagId)?.name ?? "(已删标签)"} ｜ 到期：
                {c.srs.dueAt === 0 ? " 新卡" : new Date(c.srs.dueAt).toLocaleDateString()}
              </div>
            </div>
            <div className="row">
              <button className="btn" onClick={() => { setEditing(c); setCreating(false); }}>编辑</button>
              <button className="btn danger" onClick={() => remove(c.id)}>删除</button>
            </div>
          </div>
        </div>
      ))}

      <Toast text={toast} />
    </div>
  );
}
