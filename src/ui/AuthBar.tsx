import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function AuthBar() {
  const [email, setEmail] = useState<string | null>(null);

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    setEmail(data.session?.user.email ?? null);
  }

  useEffect(() => {
    refreshSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700 }}>云同步状态</div>
        <div className="muted">
          {email ? `已登录：${email}` : "未登录（请在首页登录）"}
        </div>
      </div>
    </div>
  );
}
