import { useRef, useState } from "react";
import type { AnyCard, DeckType } from "../types";

export function CardView(props: {
  type: DeckType;
  card: AnyCard;
  showBack: boolean;
  setShowBack: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setDx(0);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current == null) return;
    setDx(e.touches[0].clientX - startX.current);
  }
  function onTouchEnd() {
    if (Math.abs(dx) > 60) {
      if (dx > 0) props.onPrev();
      else props.onNext();
      props.setShowBack(false);
    }
    startX.current = null;
    setDx(0);
  }

  const c = props.card as any;

  return (
    <div
      className="card"
      style={{ minHeight: 220, touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {!props.showBack ? (
        <>
          <div className="muted">正面</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 10 }}>{c.front}</div>
        </>
      ) : (
        <>
          <div className="muted">反面</div>

          {props.type === "vocab" ? (
            <>
              <div style={{ marginTop: 8 }}><b>读音：</b>{c.reading || "-"}</div>
              <div style={{ marginTop: 8 }}><b>词性：</b>{c.pos || "-"}</div>
              <div style={{ marginTop: 8 }}><b>意思：</b>{c.meaning || "-"}</div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 8 }}><b>接续：</b>{c.connect || "-"}</div>
              <div style={{ marginTop: 8 }}><b>意思：</b>{c.meaning || "-"}</div>
              <div style={{ marginTop: 8 }}><b>使用特性：</b>{c.feature || "-"}</div>
              <div style={{ marginTop: 8 }}><b>例句：</b>{c.example || "-"}</div>
            </>
          )}
        </>
      )}

      <div className="space" />
      <div className="row">
        <button className="btn" onClick={() => props.setShowBack(!props.showBack)}>
          {props.showBack ? "隐藏答案" : "查看答案"}
        </button>
        <button className="btn" onClick={() => { props.onPrev(); props.setShowBack(false); }}>上一张</button>
        <button className="btn" onClick={() => { props.onNext(); props.setShowBack(false); }}>下一张</button>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>提示：左右滑动切换上一张/下一张</div>
    </div>
  );
}
