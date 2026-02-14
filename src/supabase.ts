import { createClient } from "@supabase/supabase-js";

// ✅ iOS/内置浏览器有时 localStorage 会写入失败或被禁用：做一个可用性检测+降级
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function safeLocalStorage(): StorageLike | null {
  try {
    const k = "__srs_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

function safeSessionStorage(): StorageLike | null {
  try {
    const k = "__srs_test__";
    sessionStorage.setItem(k, "1");
    sessionStorage.removeItem(k);
    return sessionStorage;
  } catch {
    return null;
  }
}

const storage: StorageLike =
  safeLocalStorage() ??
  safeSessionStorage() ?? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: storage as any, // ✅ 兼容 Supabase 的 storage 接口
    storageKey: "srs-pwa-auth",
    flowType: "pkce", // ✅ 避免 hash(#) 冲突，手机端更稳
  },
});
