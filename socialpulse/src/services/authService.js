import api, { unwrap, fail } from "./api";
import { getRefreshToken, setSession } from "./session";
const store = (d) => { setSession(d); return d; };
export const login = (identifier, password) => api.post("/auth/login", { identifier, password }).then(unwrap).then(store).catch(fail);
export const register = (b) => api.post("/auth/register", b).then(unwrap).then(store).catch(fail);
export const logout = async () => { const refreshToken = getRefreshToken(); try { if (refreshToken) await api.post("/auth/logout", { refreshToken }); } catch { /* best effort */ } setSession(null); };
export const me = () => api.get("/users/me").then(unwrap).catch(fail);
