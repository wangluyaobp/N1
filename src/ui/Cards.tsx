import { useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { deleteCard, putCard } from "../db";
import { EditCard } from "./EditCard";
import { Toast } from "./Toast";

const dirtyKey = (type: DeckType) => `srs_dirty_${type}`;
function markDirty(type: DeckType) {
  localStorage.setItem(dirtyKey(type), "1");
}

export function Cards(props: {
  type: DeckType;
  tags: BatchTag[];
  cards: AnyCard[];
  onRefresh: () => Promise<void>;
  activeTagId: string | "ALL";
  setActiveTagId: (id: string | "ALL") => void;
}) {
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<AnyCard | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [createTagId, setCreateTagId] = useState<string>("");

  // ✅ 新条件：未筛选（ALL）时不显示列表
  const isFiltered = props.activeTagId !== "ALL";

  // ✅ 性能：轻量搜索索引（仅在需要展示时计算更省）
  const searchIndex = useMemo(() => {
    if (!isFiltered) return [] as string[];
    return props.cards.map((c) => {
      if (props.type === "vocab") {
        const reading = (c as any).reading ?? "";
        const meaning = (c as any).meaning ?? "";
        const pos = (c as any).pos ?? "";
        return `${c.front} ${reading} ${meaning} ${pos}`.toLowerCase();
      } else {
        const connect = (c as any).connect ?? "";
        const meaning = (c as any).meaning ?? "";
        const feature = (c as any).feature ?? "";
        const example = (c as any).example ?? "";
        return `${c.front} ${connect} ${meaning} ${feature} ${example}`.toLowerCase();
      }
    });
  }, [props.cards, props.type, isFiltered]);

  const filtered = useMemo(() => {
    if (!isFiltered) return [] as AnyCard[];
    const s = q.trim().toLowerCase();
    if (!s) return props.cards;

    const out: AnyCard[] = [];
    for (let i = 0; i < props.cards.length; i++) {
      if (searchIndex[i]?.includes(s)) out.push(props.cards[i]);
    }
    return out;
  }, [props.cards, q, searchIndex, isFiltered]);

  // ✅ 分页
  const [visible, setVisible] = useState(80);
  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  async function save(card: AnyCard) {
    await putCard(card);
    markDirty(props.type);
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
    markDirty(props.type);
    await props.onRefresh();
    setToast("已删除");
    setTimeout(() => setToast(""), 1200);
  }

  const canCreate = props.tags.length > 0;
  const tagIdForCreate = createTagId || props.tags[0]?.id || "";

  function renderSubLine(c: AnyCard) {
    if (props.type === "vocab") {
      const reading = (c as any).reading ?? "";
      const meaning = (c as any).meaning ?? "";
      return (
        <div className="muted">
          {reading ? `读音：${reading}` : "读音：-"}
          {meaning ? ` ｜ 意思：${meaning}` : " ｜ 意思：-"}
        </div>
      );
    }
    const connect = (c as any).connect ?? "";
    const meaning = (c as any).meaning ?? "";
    return (
      <div className="muted">
        {connect ? `接续：${connect}` : "接续：-"}
        {meaning ? ` ｜ 意思：${meaning}` : " ｜ 意思：-"}
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>配合管理</h3>

      <div className="row">
        <select
          value={props.activeTagId}
          onChange={(e) => {
            props.setActiveTagId(e.target.value as any);
            setVisible(80);
            setQ("");
            setEditing(null);
            setCreating(false);
          }}
        >
          <option value="ALL">（请选择要显示的标签）</option>
          {props.tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setVisible(80);
          }}
          placeholder={isFiltered ? "搜索（单词/读音/意思/例句…）" : "先选择标签后再搜索"}
          style={{ minWidth: 260 }}
          disabled={!isFiltered}
        />

        <select value={createTagId} onChange={(e) => setCreateTagId(e.target.value)}>
          <option value="">（新增卡：默认第一个标签）</option>
          {props.tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
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

      {!isFiltered ? (
        <div className="muted">请先在左侧下拉框选择一个标签，选择后才会显示该标签内的卡片。</div>
      ) : (
        <>
          <div className="muted">
            当前标签内：{props.cards.length} 张 ｜ 命中：{filtered.length} 张（本页渲染：{shown.length} 张）
          </div>

          <div className="space" />

          {(creating || editing) && (
            <EditCard
              type={props.type}
              initial={editing ?? undefined}
              tagId={editing?.tagId ?? tagIdForCreate}
              onSave={save}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          )}

          <div className="space" />
          <hr />

          {shown.map((c) => (
            <div key={c.id} className="card" style={{ padding: 12 }}>
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{c.front}</div>
                  {renderSubLine(c)}
                </div>

                <div className="row" style={{ gap: 10, flexShrink: 0, flexWrap: "nowrap" }}>
                  <button
                    className="btn"
                    onClick={() => {
                      setEditing(c);
                      setCreating(false);
                    }}
                  >
                    编辑
                  </button>
                  <button className="btn danger" onClick={() => remove(c.id)}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {shown.length < filtered.length && (
            <>
              <div className="space" />
              <button className="btn" onClick={() => setVisible((v) => Math.min(filtered.length, v + 80))}>
                加载更多（+80）
              </button>
            </>
          )}
        </>
      )}

      <Toast text={toast} />
    </div>
  );
}
