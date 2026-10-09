import api, { unwrap, fail } from "./api";

// Swap for: GET /posts?cursor=&limit=  -> { items, nextCursor }
export const listFeed = ({ cursor, limit = 20 } = {}) =>
  api.get("/posts", { params: { cursor, limit } }).then(unwrap).catch(fail);

// Swap for: POST|DELETE /posts/:id/reactions  -> { postId, isLiked, likes }
export const toggleLike = (postId, currentlyLiked) =>
  (currentlyLiked
    ? api.delete(`/posts/${postId}/reactions`)
    : api.post(`/posts/${postId}/reactions`, { reactionType: "like" })
  ).then(unwrap).catch(fail);

// Swap for: POST /posts/:id/comments  -> comment { id, user, text, ... }
export const addComment = (postId, text) =>
  api.post(`/posts/${postId}/comments`, { content: text }).then(unwrap).catch(fail);

// Swap for: POST /posts. The server parses #hashtags from the caption, so any
// hashtags not already in the caption are appended to it here.
export const createPost = ({ caption = "", hashtags = [], visibility = "public", mediaUrls } = {}) => {
  const extra = (hashtags || [])
    .map((h) => "#" + String(h).replace(/^#/, ""))
    .filter((h) => !caption.toLowerCase().includes(h.toLowerCase()));
  const full = [caption.trim(), ...extra].filter(Boolean).join(" ");
  return api.post("/posts", { caption: full, visibility, ...(mediaUrls ? { mediaUrls } : {}) }).then(unwrap).catch(fail);
};

// Swap for: POST|DELETE /posts/:id/bookmark  -> { postId, isBookmarked }
export const toggleBookmark = (postId, currentlyBookmarked) =>
  (currentlyBookmarked ? api.delete(`/posts/${postId}/bookmark`) : api.post(`/posts/${postId}/bookmark`))
    .then(unwrap).catch(fail);

// Assumed content-service routes (verify against your controller): GET /posts?authorId=, GET /posts/bookmarks, GET /posts/hashtags/:tag
export const listByAuthor = (authorId, { cursor, limit = 30 } = {}) => api.get("/posts", { params: { authorId, cursor, limit } }).then(unwrap).catch(fail);
export const listBookmarks = ({ cursor, limit = 30 } = {}) => api.get("/posts/bookmarks", { params: { cursor, limit } }).then(unwrap).catch(fail);
export const listByHashtag = (tag, { cursor, limit = 30 } = {}) => api.get(`/posts/hashtags/${encodeURIComponent(tag.replace(/^#/, ""))}`, { params: { cursor, limit } }).then(unwrap).catch(fail);
export const reportPost = (postId, reason, details) => api.post(`/posts/${postId}/report`, { reason, details }).then(unwrap).catch(fail);

export default { listByAuthor, listBookmarks, listByHashtag, reportPost, listFeed, toggleLike, addComment, createPost, toggleBookmark };
