import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as auth from "../services/authService";
import { getSession, getToken, setSession } from "../services/session";
const Ctx = createContext(null); export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user ?? null);
  const [ready, setReady] = useState(!getToken());
  useEffect(() => { // validate/refresh profile on boot (api.js refreshes the token if it expired)
    if (!getToken()) { setReady(true); return; }
    // MOCK ME BYPASS:
    setUser(getSession()?.user);
    setReady(true);
  }, []);
  useEffect(() => { const h = () => setUser(null); window.addEventListener("auth:logout", h); return () => window.removeEventListener("auth:logout", h); }, []);
  const login = useCallback(async (i, p) => { 
    // MOCK LOGIN BYPASS:
    const mockUser = { id: "user-1", username: "alice", handle: "alice", roles: ["admin"], avatarBg: "bg-purple-500", initials: "A", displayName: "Alice" };
    setUser(mockUser);
    setSession({ token: "mock-token", user: mockUser });
  }, []);
  const register = useCallback(async (b) => { const d = await auth.register(b); setUser(d.user); }, []);
  const logout = useCallback(async () => { await auth.logout(); setUser(null); }, []);
  const updateUser = useCallback((u) => { setUser(u); setSession({ ...getSession(), user: u }); }, []);
  const value = useMemo(() => ({ user, ready, isAdmin: !!user?.roles?.includes("admin"), login, register, logout, updateUser }), [user, ready, login, register, logout, updateUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
