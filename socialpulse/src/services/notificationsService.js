import api, { unwrap, fail } from "./api";
const c = (p) => p.then(unwrap).catch(fail);
export const listNotifications = (cursor) => c(api.get("/notifications", { params: { cursor, limit: 20 } }));
export const unreadCount = () => c(api.get("/notifications/unread-count"));
export const markAllRead = () => c(api.post("/notifications/read-all"));
export const markRead = (id) => c(api.post(`/notifications/${id}/read`));
