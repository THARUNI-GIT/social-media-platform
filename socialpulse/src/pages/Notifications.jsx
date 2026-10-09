import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
import { markAllRead, markRead } from "../services/notificationsService";
import { getUser } from "../services/usersService";
import { ListSkeleton, Page } from "../components/ui";
const names = new Map(); // tiny id -> name cache (notifications carry actor ids only)
const useName = (id) => { const [n, setN] = useState(names.get(id)); useEffect(() => { if (!names.has(id)) getUser(id).then((u) => { names.set(id, u.displayName); setN(u.displayName); }).catch(() => {}); }, [id]); return n || "Someone"; };
const text = (n, who) => {
  const more = n.count > 1 && n.type === "like" ? ` and ${n.count - 1} other${n.count > 2 ? "s" : ""}` : "";
  return { like: `${who}${more} liked your post`, comment: `${who} commented: ${n.preview ?? ""}`, share: `${who} shared your post`, follow: `${who} started following you`, message: `${who} sent ${n.count > 1 ? `${n.count} messages` : "a message"}` }[n.type] ?? "New activity";
};
function Row({ n, onRead }) {
  const who = useName(n.actorId); const to = n.type === "follow" ? `/profile/${n.actorId}` : n.type === "message" ? "/chat" : "/";
  return <Link to={to} onClick={() => !n.read && onRead(n)} className={`block rounded-xl px-3 py-3 text-sm ${n.read ? "bg-white" : "bg-indigo-50 font-medium"}`}>{text(n, who)}</Link>;
}
export default function Notifications() {
  const { items, setItems, setUnread } = useNotifications(); const [first, setFirst] = useState(true);
  useEffect(() => { const t = setTimeout(() => setFirst(false), 400); return () => clearTimeout(t); }, []);
  const readAll = async () => { await markAllRead().catch(() => {}); setItems((p) => p.map((x) => ({ ...x, read: true }))); setUnread(0); };
  const readOne = async (n) => { setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x))); markRead(n.id).then((r) => setUnread(r.unread)).catch(() => {}); };
  return (
    <Page><div className="flex items-center justify-between"><h1 className="text-lg font-bold">Notifications</h1><button onClick={readAll} className="text-sm text-indigo-600">Mark all read</button></div>
      {first && !items.length ? <ListSkeleton /> : !items.length ? <p className="text-sm text-gray-400">You're all caught up.</p> : <div className="space-y-2">{items.map((n) => <Row key={n.id} n={n} onRead={readOne} />)}</div>}
    </Page>
  );
}
