import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { searchUsers } from "../services/usersService";
import { Avatar, ListSkeleton, Page } from "../components/ui";
export default function Search() {
  const [q, setQ] = useState(""); const [items, setItems] = useState(null); const [loading, setLoading] = useState(false); const toast = useToast(); const nav = useNavigate();
  useEffect(() => {
    const term = q.trim(); if (!term || term.startsWith("#")) { setItems(null); return; }
    setLoading(true); const t = setTimeout(() => searchUsers(term).then((r) => setItems(r.items)).catch((e) => toast(e.message)).finally(() => setLoading(false)), 300);
    return () => clearTimeout(t); // debounce
  }, [q]);
  return (
    <Page>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.startsWith("#") && nav(`/explore/${q.slice(1)}`)} placeholder="Search people, or #hashtag + Enter" className="w-full rounded-xl border px-3 py-3 text-base" />
      {loading && <ListSkeleton />}
      {!loading && items?.length === 0 && <p className="text-sm text-gray-400">No users found.</p>}
      {!loading && items?.map((u) => (
        <Link key={u.id} to={`/profile/${u.id}`} className="flex items-center gap-3"><Avatar user={u} /><div><p className="text-sm font-semibold">{u.displayName}{u.verified && " ✔"}</p><p className="text-xs text-gray-500">@{u.handle}</p></div></Link>
      ))}
    </Page>
  );
}
