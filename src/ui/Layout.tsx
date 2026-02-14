import React from "react";

export function Layout(props: { title: string; children: React.ReactNode; onBack?: ()=>void }) {
  return (
    <div className="container">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div className="row">
          {props.onBack && <button className="btn" onClick={props.onBack}>← 返回</button>}
          <h2 style={{margin:0}}>{props.title}</h2>
        </div>
      </div>
      <div className="space" />
      {props.children}
      <div className="space" />
      <div className="muted">离线数据保存在本机（IndexedDB）。</div>
    </div>
  );
}
