import { useState } from "react";
import type { AnyCard, DeckType, GrammarCard, VocabCard } from "../types";
import { defaultSrs } from "../srs";
import { v4 as uuid } from "uuid";

export function EditCard(props: {
  type: DeckType;
  initial?: AnyCard;
  tagId: string;
  onSave: (card: AnyCard) => Promise<void>;
  onCancel: () => void;
}) {
  const now = Date.now();

  const init: AnyCard = props.initial ?? (
    props.type === "vocab"
      ? ({
          id: uuid(),
          type: "vocab",
          tagId: props.tagId,
          front: "",
          reading: "",
          pos: "",
          meaning: "",
          srs: defaultSrs(),
          createdAt: now,
          updatedAt: now,
        } as VocabCard)
      : ({
          id: uuid(),
          type: "grammar",
          tagId: props.tagId,
          front: "",
          connect: "",
          meaning: "",
          feature: "",        // ✅ 新增
          example: "",
          srs: defaultSrs(),
          createdAt: now,
          updatedAt: now,
        } as GrammarCard)
  );

  const [draft, setDraft] = useState<AnyCard>(init);

  function setField(key: string, value: string) {
    setDraft((d) => ({ ...(d as any), [key]: value, updatedAt: Date.now() }) as AnyCard);
  }

  const isEdit = !!props.initial;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{isEdit ? "编辑卡片" : "新增卡片"}</h3>

      {props.type === "vocab" ? (
        <>
          <div className="muted">正面：单词</div>
          <input value={(draft as any).front} onChange={(e) => setField("front", e.target.value)} placeholder="单词" />
          <div className="space" />
          <div className="muted">反面：读音（音调+假名） / 词性 / 意思</div>
          <input value={(draft as any).reading} onChange={(e) => setField("reading", e.target.value)} placeholder="读音（音调+假名）" />
          <div className="space" />
          <input value={(draft as any).pos} onChange={(e) => setField("pos", e.target.value)} placeholder="词性" />
          <div className="space" />
          <input value={(draft as any).meaning} onChange={(e) => setField("meaning", e.target.value)} placeholder="意思" />
        </>
      ) : (
        <>
          <div className="muted">正面：文法</div>
          <input value={(draft as any).front} onChange={(e) => setField("front", e.target.value)} placeholder="文法" />
          <div className="space" />
          <div className="muted">反面：接续 / 意思 / 使用特性 / 例句</div>
          <input value={(draft as any).connect} onChange={(e) => setField("connect", e.target.value)} placeholder="接续" />
          <div className="space" />
          <input value={(draft as any).meaning} onChange={(e) => setField("meaning", e.target.value)} placeholder="意思" />
          <div className="space" />
          <input value={(draft as any).feature} onChange={(e) => setField("feature", e.target.value)} placeholder="使用特性" />
          <div className="space" />
          <input value={(draft as any).example} onChange={(e) => setField("example", e.target.value)} placeholder="例句" />
        </>
      )}

      <div className="space" />
      <div className="row">
        <button className="btn primary" onClick={() => props.onSave(draft)}>保存</button>
        <button className="btn" onClick={props.onCancel}>取消</button>
      </div>
    </div>
  );
}
