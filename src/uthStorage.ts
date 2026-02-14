type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function safeLocal(): StorageLike | null {
  try {
    const k = "__t";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

function safeSession(): StorageLike | null {
  try {
    const k = "__t";
    sessionStorage.setItem(k, "1");
    sessionStorage.removeItem(k);
    return sessionStorage;
  } catch {
    return null;
  }
}

const chosen = safeLocal() ?? safeSession();

export const authStorage: StorageLike = chosen ?? {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
