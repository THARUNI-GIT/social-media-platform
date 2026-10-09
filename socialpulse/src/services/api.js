import axios from "axios";
import { getRefreshToken, getSession, getToken, setSession } from "./session";

const base = import.meta.env.VITE_API_URL;
const api = axios.create({ baseURL: base });
api.interceptors.request.use((cfg) => { const t = getToken(); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });

// Single-flight refresh: concurrent 401s share one refresh call, then retry once.
let refreshing = null;
const refresh = () => (refreshing ??= axios.post(`${base}/auth/refresh`, { refreshToken: getRefreshToken() })
  .then((r) => { const d = r.data.data; setSession({ ...getSession(), accessToken: d.accessToken, refreshToken: d.refreshToken }); return d.accessToken; })
  .finally(() => { refreshing = null; }));

api.interceptors.response.use((r) => r, async (err) => {
  const cfg = err.config;
  if (err.response?.status === 401 && cfg && !cfg._retry && getRefreshToken() && !cfg.url?.startsWith("/auth/")) {
    cfg._retry = true;
    try { const t = await refresh(); cfg.headers.Authorization = `Bearer ${t}`; return api(cfg); }
    catch { setSession(null); window.dispatchEvent(new Event("auth:logout")); }
  }
  return Promise.reject(err);
});

// Unwrap the { success, data, error } envelope; throw the server's message on failure.
export const unwrap = (res) => res.data.data;
export const fail = (e) => { throw new Error(e.response?.data?.error?.message || e.message); };
export default api;
