import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AuthUser, getMe, login as apiLogin, logout as apiLogout } from "./auth";

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await getMe();
    setUser(res.type === "success" ? res.data : null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    if (res.type === "success") { setUser(res.data); return { ok: true }; }
    return { ok: false, message: res.type === "error" ? res.message : "Login failed" };
  }, []);

  const logout = useCallback(async () => { await apiLogout(); setUser(null); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
