import { useEffect, useMemo, useState } from "react";
import type { AnyCard, BatchTag, DeckType } from "../types";
import { Layout } from "./Layout";
import { Cards } from "./Cards";
import { Study } from "./Study";
import { Tags } from "./Tags";
import { listCardsByType, listTags } from "../db";
import { AuthBar } from "./AuthBar"; // ✅ 只读状态栏

type Tab = "tags" | "cards" | "study";

export function Module(props: { type: DeckType; go: (p: "/" | "/vocab" | "/grammar") => void }) {
  const title = props.type === "vocab" ? "单词卡片组" : "文法对应组";
  const [tab, setTab] = useState<Tab>("tags");
  const [tags, setTags] = useState<BatchTag[]>([]);
  const [cards, setCards] = useState<AnyCard[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | "ALL">("ALL");

  async function refresh() {
    const [t, c] = await Promise.all([listTags(props.type), listCardsByType(props.type)]);
    t.sort((a, b) => b.createdAt - a.createdAt);
    setTags(t);
    setCards(c);
  }

  useEffect(() => {
    refresh();
  }, [props.type]);

  const filteredCards = useMemo(() => {
    if (activeTagId === "ALL") return cards;
    return cards.filter((c) => c.tagId === activeTagId);
  }, [cards, activeTagId]);

  return (
    <Layout title={title} onBack={() => props.go("/")}>
      <div className="row">
        <button className={"btn" + (tab === "tags" ? " primary" : "")} onClick={() => setTab("tags")}>
          标签/导入
        </button>
        <button className={"btn" + (tab === "cards" ? " primary" : "")} onClick={() => setTab("cards")}>
          配合管理
        </button>
        <button className={"btn" + (tab === "study" ? " primary" : "")} onClick={() => setTab("study")}>
          学习
        </button>
      </div>

      <div className="space" />

      {/* ✅ 只显示登录状态（登录/同步放到首页做） */}
      <AuthBar />

      <div className="space" />

      {tab === "tags" && (
        <Tags
          type={props.type}
          tags={tags}
          cards={cards}
          onRefresh={refresh}
          activeTagId={activeTagId}
          setActiveTagId={setActiveTagId}
        />
      )}

      {tab === "cards" && (
        <Cards
          type={props.type}
          tags={tags}
          cards={filteredCards}
          onRefresh={refresh}
          activeTagId={activeTagId}
          setActiveTagId={setActiveTagId}
        />
      )}

      {tab === "study" && <Study type={props.type} tags={tags} cards={filteredCards} onUpdated={refresh} />}
    </Layout>
  );
}
