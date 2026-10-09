import { useState } from "react";
import { X } from "lucide-react";
import { createPost } from "../../services/postsService";
import { uploadImage } from "../../services/mediaService";

const VISIBILITY = { Everyone: "public", "Followers only": "followers", "Close friends": "private" };

export default function CreateModal({ open, onClose, onCreated }) {
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [audience, setAudience] = useState("Everyone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  if (!open) return null;

  const publish = async () => {
    setLoading(true); setError("");
    try {
      const tags = hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
      const mediaUrls = file ? [await uploadImage(file, "post")] : undefined;
      const post = await createPost({ caption, hashtags: tags, visibility: VISIBILITY[audience], mediaUrls });
      setCaption(""); setHashtags(""); setAudience("Everyone"); setFile(null);
      onCreated?.(post); onClose();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Create post</h2><button onClick={onClose}><X size={18} /></button></div>
        <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What's on your mind?" className="w-full rounded-xl border p-3 text-sm" />
        <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="Hashtags (space or comma separated)" className="w-full rounded-xl border px-3 py-2 text-sm" />
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
          {Object.keys(VISIBILITY).map((k) => <option key={k}>{k}</option>)}
        </select>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        {file && <img src={URL.createObjectURL(file)} alt="" className="max-h-40 rounded-xl object-cover" />}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={publish} disabled={loading || (!caption.trim() && !hashtags.trim() && !file)} className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}
