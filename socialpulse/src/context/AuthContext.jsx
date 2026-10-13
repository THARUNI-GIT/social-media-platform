import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as auth from "../services/authService";
import { getSession, getToken, setSession } from "../services/session";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Validate the stored session on boot. api.js refreshes an expired access token on the first
  // 401 and clears the session (firing "auth:logout") if the refresh fails.
  useEffect(() => {
    let alive = true;
    if (!getToken()) { setReady(true); return; }
    auth.me()
      .then((u) => { if (alive) setUser(u); })
      .catch(() => { /* session is gone or invalid - api.js already cleared it */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener("auth:logout", h);
    return () => window.removeEventListener("auth:logout", h);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const d = await auth.login(identifier, password); // stores { accessToken, refreshToken, user }
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (b) => {
    const d = await auth.register(b);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout(); // best-effort server call, then clears the local session
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      setSession({ ...getSession(), user: next });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, ready, isAdmin: !!user?.roles?.includes("admin"), login, register, logout, updateUser }),
    [user, ready, login, register, logout, updateUser]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
