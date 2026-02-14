import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,      // ✅ 持久化 session
    autoRefreshToken: true,    // ✅ 自动刷新 token
    detectSessionInUrl: true,  // ✅ 邮箱登录回跳会自动读取 session
    storage: localStorage,     // ✅ 明确用 localStorage（默认也是，但这里更稳）
  },
});
