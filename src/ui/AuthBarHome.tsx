import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { syncAllFromCloud } from "../sync";

export function AuthBarHome(props: { onSynced?: () => Promise<void> }) {
  const [emailInput, setEmailInput] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 防止“登录事件触发同步”重复跑
  const syncingRef = useRef(false);

  async function refreshSession() {
    // 1) 先读 session
    const { data: s } = await supabase.auth.getSession();
    const e1 = s.session?.user.email ?? null;
    if (e1) {
      setSessionEmail(e1);
      return;
    }
    // 2) session 读不到再读 user（在部分手机环境更稳）
    const { data: u } = await supabase.auth.getUser();
    setSessionEmail(u.user?.email ?? null);
  }

  async function syncAll(reason?: string) {
    if (syncingRef.current) return;
    syncingRef.current = true;

    setMsg("");
    setBusy(true);
    try {
      await syncAllFromCloud();
      if (props.onSynced) await props.onSynced();
      setMsg(reason ? `同步完成（${reason}）` : "同步完成（单词 + 文法：云端 → 本机）");
    } catch (e: any) {
      setMsg(e?.message ?? "同步失败");
    } finally {
      setBusy(false);
      syncingRef.current = false;
    }
  }

  // ✅ 邮箱 OTP 登录（备用）
  async function signInEmail() {
    if (cooldown > 0) return;

    setMsg("");
    setBusy(true);
    try {
      // ✅ PKCE + 非 hash 回跳
      const redirectTo = `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("已发送登录邮件，请去邮箱点链接完成登录。");
      // ✅ 冷却 60 秒（避免误点；真正的 Supabase 限流可能更长）
      setCooldown(60);
    } finally {
      setBusy(false);
    }
  }

  // ✅ Google OAuth 登录（推荐：几乎不受邮件限流影响）
  async function signInGoogle() {
    setMsg("");
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) setMsg(error.message);
      // 成功会跳转到 Google，回来后由 onAuthStateChange 接管并自动同步
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setSessionEmail(null);
      setMsg("已退出登录");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshSession();

    // ✅ 再延迟读一次，兜住“刚写入 storage 的瞬间”
    const t = setTimeout(() => refreshSession(), 300);

    // ✅ 登录状态变化：登录成功后自动同步一次
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const mail = session?.user.email ?? null;
      setSessionEmail(mail);

      if (session?.user) {
        await syncAll("登录后自动同步：云端→本机");
      }
    });

    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const it = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(it);
  }, [cooldown]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800 }}>云同步（全局）</div>
        <div className="muted">{sessionEmail ? `已登录：${sessionEmail}` : "未登录"}</div>
      </div>

      <div className="space" />

      {!sessionEmail ? (
        <div style={{ display: "grid", gap: 8 }}>
          {/* ✅ Google 登录（推荐） */}
          <div className="row">
            <button className="btn primary" onClick={signInGoogle} disabled={busy}>
              使用 Google 登录（推荐）
            </button>
          </div>

          <div className="muted">若频繁遇到邮件限流，优先用 Google 登录。</div>

          <div className="space" />

          {/* ✅ 邮箱登录（备用） */}
          <div className="row">
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="邮箱登录（会发确认邮件）"
            />
            <button
              className="btn"
              onClick={signInEmail}
              disabled={busy || cooldown > 0 || !emailInput.includes("@")}
              title={cooldown > 0 ? `请等待 ${cooldown}s 再发送` : ""}
            >
              {cooldown > 0 ? `请等待 ${cooldown}s` : "邮箱登录"}
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" onClick={() => syncAll()} disabled={busy}>
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
