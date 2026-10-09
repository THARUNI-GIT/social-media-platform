import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { block, follow, getUser } from "../services/usersService";
import { listByAuthor } from "../services/postsService";
import { toUiPost } from "../adapters/postAdapter";
import { Avatar, GridSkeleton, Page, PostGrid, Skeleton } from "../components/ui";
export default function Profile() {
  const { id } = useParams(); const { user: me } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [u, setU] = useState(null); const [posts, setPosts] = useState(null); const mine = id === me.id;
  useEffect(() => {
    setU(null); setPosts(null);
    getUser(id).then(setU).catch((e) => toast(e.message));
    listByAuthor(id).then((r) => setPosts(r.items.map(toUiPost))).catch(() => setPosts([]));
  }, [id]);
  const toggleFollow = async () => { // optimistic
    const was = u.isFollowing; setU((x) => ({ ...x, isFollowing: !was, followersCount: x.followersCount + (was ? -1 : 1) }));
    try { await follow(id, !was); } catch (e) { setU((x) => ({ ...x, isFollowing: was, followersCount: x.followersCount + (was ? 1 : -1) })); toast(e.message); }
  };
  const doBlock = async () => { if (!confirm("Block this user?")) return; try { await block(id, true); toast("User blocked", "info"); nav("/"); } catch (e) { toast(e.message); } };
  if (!u) return <Page><div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div><GridSkeleton /></Page>;
  return (
    <Page>
      <div className="flex items-center gap-4"><Avatar user={u} size={80} />
        <div className="flex-1 min-w-0"><h1 className="font-bold text-lg truncate">{u.displayName}{u.verified && " ✔"}</h1><p className="text-sm text-gray-500">@{u.handle}</p>
          <p className="text-sm mt-1"><b>{u.followersCount}</b> followers · <b>{u.followingCount}</b> following</p></div></div>
      {u.bio && <p className="text-sm">{u.bio}</p>}
      <div className="flex gap-2">
        {mine ? <button onClick={() => nav("/settings")} className="flex-1 rounded-xl border py-2 text-sm font-medium">Edit profile</button>
          : <><button onClick={toggleFollow} className={`flex-1 rounded-xl py-2 text-sm font-medium ${u.isFollowing ? "border" : "bg-indigo-600 text-white"}`}>{u.isFollowing ? "Following" : "Follow"}</button>
            <button onClick={() => nav("/chat")} className="rounded-xl border px-4 text-sm">Message</button>
            <button onClick={doBlock} className="rounded-xl border px-4 text-sm text-red-600">Block</button></>}
      </div>
      {posts ? <PostGrid posts={posts} /> : <GridSkeleton />}
    </Page>
  );
}
