import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { listNotifications, unreadCount } from "../services/notificationsService";
import { connectNotifications } from "../websocket/notifySocket";
const Ctx = createContext({ unread: 0, items: [], setItems: () => {}, setUnread: () => {} }); export const useNotifications = () => useContext(Ctx);
const upsert = (list, n) => [n, ...list.filter((x) => x.id !== n.id)]; // grouped notifications re-arrive with the same id
export function NotificationsProvider({ children }) {
  const { user } = useAuth(); const [unread, setUnread] = useState(0); const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user) return;
    unreadCount().then((r) => setUnread(r.count)).catch(() => {});
    listNotifications().then((r) => setItems(r.items)).catch(() => {});
    return connectNotifications({ onNew: (n) => setItems((p) => upsert(p, n)), onUnread: setUnread });
  }, [user?.id]);
  return <Ctx.Provider value={{ unread, items, setItems, setUnread }}>{children}</Ctx.Provider>;
}
