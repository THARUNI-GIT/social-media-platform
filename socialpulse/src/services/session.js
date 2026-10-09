// Token storage. localStorage for persistence across reloads; in-memory cache for speed.
const K = "sp_auth"; let mem;
const read = () => { if (mem !== undefined) return mem; try { mem = JSON.parse(localStorage.getItem(K) || "null"); } catch { mem = null; } return mem; };
export const getSession = read;
export const setSession = (s) => { mem = s; try { s ? localStorage.setItem(K, JSON.stringify(s)) : localStorage.removeItem(K); } catch { /* storage unavailable */ } };
export const getToken = () => read()?.accessToken || null;
export const getRefreshToken = () => read()?.refreshToken || null;
export const getUserId = () => read()?.user?.id || null;
