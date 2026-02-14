import { useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { pickStudyQueue, sm2Update } from "../srs";
import { putCard } from "../db";
import { CardView } from "./CardView";
import { Toast } from "./Toast";

export function Study(props: {
  type: DeckType;
  tags: BatchTag[];
  cards: AnyCard[];
  onUpdated: ()=>Promise<void>;
}) {
  const [toast, setToast] = useState("");
  const [limit, setLimit] = useState(30);
  const [showBack, setShowBack] = useState(false);

  const queue = useMemo(()=>{
    return pickStudyQueue(props.cards, Date.now(), limit, 0.2);
  }, [props.cards, limit]);

  const [idx, setIdx] = useState(0);
  const card = queue[idx];

  function prev() { setIdx(i => Math.max(0, i-1)); }
  function next() { setIdx(i => Math.min(queue.length-1, i+1)); }

  async function rate(q: 0|3|4|5) {
    if (!card) return;
    const updated = { ...card, srs: sm2Update(card.srs, q, Date.now()), updatedAt: Date.now() } as AnyCard;
    await putCard(updated);
    await props.onUpdated();
    setToast(q < 3 ? "已标记：忘记（明天再见）" : "已安排下次复习");
    setTimeout(()=>setToast(""), 1100);
    setShowBack(false);
    // 自动下一张
    setIdx(i => Math.min(queue.length-1, i+1));
  }

  const dueCount = props.cards.filter(c => c.srs.dueAt !== 0 && c.srs.dueAt <= Date.now()).length;
  const newCount = props.cards.filter(c => c.srs.dueAt === 0).length;

  return (
    <div className="card">
      <h3 style={{marginTop:0}}>学习模式</h3>
      <div className="muted">
        到期：{dueCount} ｜ 新卡：{newCount} ｜ 本轮队列：{queue.length}
      </div>

      <div className="space" />
      <div className="row">
        <span className="muted">本轮抽取数量</span>
        <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); setIdx(0); setShowBack(false);} }>
          {[10,20,30,50,80].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="space" />

      {!card ? (
        <div className="muted">当前没有可学习的卡片。你可以导入更多，或等待到期。</div>
      ) : (
        <>
          <div className="muted">
            进度：{idx+1}/{queue.length} ｜ 标签：{props.tags.find(t=>t.id===card.tagId)?.name ?? "-"}
          </div>

          <div className="space" />
          <CardView
            type={props.type}
            card={card}
            showBack={showBack}
            setShowBack={setShowBack}
            onPrev={prev}
            onNext={next}
          />

          <div className="space" />
          <div className="row">
            <button className="btn danger" onClick={()=>rate(0)}>0 忘了</button>
            <button className="btn" onClick={()=>rate(3)}>3 勉强</button>
            <button className="btn" onClick={()=>rate(4)}>4 记得</button>
            <button className="btn primary" onClick={()=>rate(5)}>5 很熟</button>
          </div>
        </>
      )}

      <Toast text={toast} />
    </div>
  );
}
