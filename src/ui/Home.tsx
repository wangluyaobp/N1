import { Layout } from "./Layout";

export function Home(props: { go: (path: "/" | "/vocab" | "/grammar") => void }) {
  return (
    <Layout title="SRS 记忆卡">
      <div className="grid">
        <div className="card">
          <h3>单词卡片组</h3>
          <div className="muted">正面：单词｜反面：读音(音调+假名) / 词性 / 意思</div>
          <div className="space" />
          <button className="btn primary" onClick={()=>props.go("/vocab")}>进入单词模块</button>
        </div>
        <div className="card">
          <h3>文法卡片组</h3>
          <div className="muted">正面：文法｜反面：接续 / 意思 / 例句</div>
          <div className="space" />
          <button className="btn primary" onClick={()=>props.go("/grammar")}>进入文法模块</button>
        </div>
      </div>
    </Layout>
  );
}
