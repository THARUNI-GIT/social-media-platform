import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { listBookmarks, listByHashtag } from "../services/postsService";
import { toUiPost } from "../adapters/postAdapter";
import { GridSkeleton, Page, PostGrid } from "../components/ui";
/** /explore/:tag (hashtag feed) and /bookmarks (no tag). */
export default function Explore({ bookmarks = false }) {
  const { tag } = useParams(); const toast = useToast(); const [posts, setPosts] = useState(null);
  useEffect(() => { setPosts(null); (bookmarks ? listBookmarks() : listByHashtag(tag)).then((r) => setPosts(r.items.map(toUiPost))).catch((e) => { toast(e.message); setPosts([]); }); }, [tag, bookmarks]);
  return <Page><h1 className="text-lg font-bold">{bookmarks ? "Bookmarks" : `#${tag}`}</h1>{posts ? <PostGrid posts={posts} /> : <GridSkeleton />}</Page>;
}
