import api, { unwrap, fail } from "./api";
const c = (p) => p.then(unwrap).catch(fail);
export const getUser = (id) => c(api.get(`/users/${id}`));
export const updateMe = (b) => c(api.patch("/users/me", b));
export const searchUsers = (q, cursor) => c(api.get("/users/search", { params: { q, cursor, limit: 20 } }));
export const follow = (id, on) => c(on ? api.post(`/users/${id}/follow`) : api.delete(`/users/${id}/follow`));
export const block = (id, on) => c(on ? api.post(`/users/${id}/block`) : api.delete(`/users/${id}/block`));
export const listBlocks = () => c(api.get("/users/me/blocks"));
// admin
export const adminOverview = () => c(api.get("/admin/overview"));
export const adminReports = (status = "open") => c(api.get("/admin/reports", { params: { status } }));
export const adminResolve = (id, action) => c(api.post(`/admin/reports/${id}/resolve`, { action }));
export const adminUsers = (q) => c(api.get("/admin/users", { params: { q } }));
export const adminSuspend = (id, on) => c(api.post(`/admin/users/${id}/${on ? "suspend" : "unsuspend"}`));
