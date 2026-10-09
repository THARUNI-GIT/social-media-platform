import { useCallback, useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import CreateModal from "../components/create/CreateModal";
import { addComment, listFeed, toggleBookmark, toggleLike, reportPost } from "../services/postsService";
import { toUiPost } from "../adapters/postAdapter";
import { Flag } from "lucide-react";

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [bookmarked, setBookmarked] = useState({}); // API post has no isBookmarked; tracked locally
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (c) => {
    setLoading(true); setError("");
    try {
      const { items, nextCursor } = await listFeed({ cursor: c, limit: 20 });
      setPosts((p) => (c ? [...p, ...items.map(toUiPost)] : items.map(toUiPost))); setCursor(nextCursor);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = (id, fn) => setPosts((p) => p.map((x) => (x.id === id ? fn(x) : x)));

  const like = async (post) => {
    const was = post.isLiked;
    patch(post.id, (x) => ({ ...x, isLiked: !was, likes: x.likes + (was ? -1 : 1) })); // optimistic
    try { const r = await toggleLike(post.id, was); patch(post.id, (x) => ({ ...x, isLiked: r.isLiked, likes: r.likes })); }
    catch { patch(post.id, (x) => ({ ...x, isLiked: was, likes: post.likes })); setError("Couldn't update like"); } // roll back
  };
  const comment = async (post) => {
    const text = (drafts[post.id] || "").trim(); if (!text) return;
    try { const c = await addComment(post.id, text); patch(post.id, (x) => ({ ...x, comments: [...x.comments, { id: c.id, user: c.user, text: c.text }] })); setDrafts((d) => ({ ...d, [post.id]: "" })); }
    catch (e) { setError(e.message); }
  };
  const bookmark = async (post) => {
    const was = !!bookmarked[post.id];
    setBookmarked((b) => ({ ...b, [post.id]: !was }));
    try { await toggleBookmark(post.id, was); } catch { setBookmarked((b) => ({ ...b, [post.id]: was })); setError("Couldn't update bookmark"); }
  };

  const report = async (post) => {
    const reason = window.prompt("Why are you reporting this post? (spam, harassment, hate, violence, nudity, misinformation, other)", "other");
    if (!reason) return;
    try {
      await reportPost(post.id, reason, "Reported by user");
      alert("Post reported successfully.");
    } catch (e) {
      alert("Failed to report post: " + e.message);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4 pb-24">
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"><Plus size={16} /> New post</button><Link to="/bookmarks" className="ml-3 text-sm text-indigo-600">Bookmarks</Link>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {loading && !posts.length && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading && !error && !posts.length && <p className="text-sm text-gray-400">No posts yet.</p>}
        {posts.map((p) => (
          <article key={p.id} className="rounded-2xl border bg-white overflow-hidden">
            <header className="flex items-center gap-3 p-4">
              <span className={`w-10 h-10 rounded-full ${p.author.avatarBg} flex items-center justify-center text-sm font-semibold text-white`}>{p.author.initials}</span>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{p.author.name}{p.author.verified && " ✔"}</p><p className="text-xs text-gray-500">{p.author.handle} · {p.author.timeAgo}</p></div>
              <button onClick={() => report(p)} className="text-gray-400 hover:text-red-500"><Flag size={16} /></button>
            </header>
            {(p.mediaUrls?.[0] ?? p.mediaUrl) ? <img src={p.mediaUrls?.[0] ?? p.mediaUrl} alt="" loading="lazy" className="w-full max-h-96 object-cover bg-gray-100" /> : <div className="h-48" style={{ background: p.gradientStyle }} />}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-4">
                <button onClick={() => like(p)} className="flex items-center gap-1 text-sm"><Heart size={20} className={p.isLiked ? "fill-rose-500 text-rose-500" : "text-gray-600"} />{p.likes}</button>
                <span className="flex items-center gap-1 text-sm text-gray-600"><MessageCircle size={20} />{p.comments.length}</span>
                <button onClick={() => bookmark(p)} className="ml-auto"><Bookmark size={20} className={bookmarked[p.id] ? "fill-indigo-600 text-indigo-600" : "text-gray-600"} /></button>
              </div>
              {p.caption && <p className="text-sm">{p.caption}</p>}
              {!!p.tags.length && <p className="text-sm">{p.tags.map((t) => <Link key={t} to={`/explore/${t.replace(/^#/, "")}`} className="text-indigo-600 mr-1">{t}</Link>)}</p>}
              {p.comments.map((c) => <p key={c.id} className="text-sm"><b>{c.user}</b> {c.text}</p>)}
              <div className="flex gap-2 pt-1">
                <input value={drafts[p.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && comment(p)} placeholder="Add a comment…" className="flex-1 rounded-lg border px-3 py-1.5 text-sm" />
                <button onClick={() => comment(p)} className="text-sm font-medium text-indigo-600">Post</button>
              </div>
            </div>
          </article>
        ))}
        {cursor && <button onClick={() => load(cursor)} disabled={loading} className="w-full rounded-xl border bg-white py-2 text-sm">{loading ? "Loading…" : "Load more"}</button>}
      </div>
      <CreateModal open={creating} onClose={() => setCreating(false)} onCreated={() => load()} />
    </AppLayout>
  );
}
