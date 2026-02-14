import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { syncAllFromCloud } from "../sync";

export function AuthBarHome(props: { onSynced?: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    setSessionEmail(data.session?.user.email ?? null);
  }

  async function syncAll() {
    setMsg("");
    setBusy(true);
    try {
      await syncAllFromCloud();
      if (props.onSynced) await props.onSynced();
      setMsg("同步完成（单词 + 文法：云端 → 本机）");
    } catch (e: any) {
      setMsg(e?.message ?? "同步失败");
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setMsg("");
    setBusy(true);
    try {
      // ✅ Hash 路由：确保回跳到 /#/
      const redirectTo = `${window.location.origin}/#/`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) setMsg(error.message);
      else setMsg("已发送登录邮件，请去邮箱点链接完成登录。");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setMsg("已退出登录");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // 进来先刷新一次 session（用于“刷新不掉登录”验证）
    refreshSession();

    // ✅ 监听登录状态变化：登录成功后自动同步全部
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSessionEmail(session?.user.email ?? null);

      if (session?.user) {
        // 登录成功后自动同步
        await syncAll();
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>云同步（全局）</div>
        <div className="muted">{sessionEmail ? `已登录：${sessionEmail}` : "未登录"}</div>
      </div>

      <div className="space" />

      {!sessionEmail ? (
        <div className="row">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="输入邮箱登录（会发确认邮件）"
          />
          <button className="btn primary" onClick={signIn} disabled={busy || !email.includes("@")}>
            登录
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" onClick={syncAll} disabled={busy}>
            同步全部（云端→本机）
          </button>
          <button className="btn" onClick={signOut} disabled={busy}>
            退出
          </button>
        </div>
      )}

      {msg && <div className="muted" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
