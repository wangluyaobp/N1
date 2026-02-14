import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { DeckType } from "../types";
import { syncFromCloud } from "../sync";

export function AuthBar(props: { type: DeckType; onSynced: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    setSessionEmail(data.session?.user.email ?? null);
  }

useEffect(() => {
  refreshSession();

  const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
    await refreshSession();
    // ✅ 登录成功后自动同步一次
    if (session?.user) {
      try {
        await syncFromCloud(props.type);
        await props.onSynced();
        setMsg("已登录并自动同步完成");
      } catch (e: any) {
        setMsg(e?.message ?? "自动同步失败");
      }
    }
  });

  return () => sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setMsg(error.message);
    else setMsg("已发送登录邮件，请去邮箱点确认链接完成登录。");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("已退出登录");
  }

  async function syncNow() {
    setMsg("");
    try {
      await syncFromCloud(props.type);
      await props.onSynced();
      setMsg("同步完成（云端 → 本机）");
    } catch (e: any) {
      setMsg(e?.message ?? "同步失败");
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>云同步</div>
        <div className="muted">{sessionEmail ? `已登录：${sessionEmail}` : "未登录"}</div>
      </div>

      <div className="space" />

      {!sessionEmail ? (
        <div className="row">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入邮箱登录（会发确认邮件）" />
          <button className="btn primary" onClick={signIn} disabled={!email.includes("@")}>
            发送登录邮件
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" onClick={syncNow}>同步（云端→本机）</button>
          <button className="btn" onClick={signOut}>退出</button>
        </div>
      )}

      {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
