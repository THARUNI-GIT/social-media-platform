import { motion } from "framer-motion";
export const Skeleton = ({ className = "h-4 w-full" }) => <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
export const ListSkeleton = ({ rows = 4 }) => <div className="space-y-3">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-3/4" /></div></div>)}</div>;
export const GridSkeleton = () => <div className="grid grid-cols-3 gap-1">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-none" />)}</div>;
export const Page = ({ children }) => <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="max-w-xl mx-auto p-4 pb-24 space-y-4">{children}</motion.div>;
export const Avatar = ({ user, size = 40 }) => user?.avatarUrl
  ? <img src={user.avatarUrl} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
  : <span style={{ width: size, height: size }} className="rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">{(user?.displayName || user?.handle || "?").slice(0, 1).toUpperCase()}</span>;
export function PostGrid({ posts }) {
  if (!posts.length) return <p className="text-sm text-gray-400 text-center py-8">Nothing here yet.</p>;
  return <div className="grid grid-cols-3 gap-1">{posts.map((p) => {
    const img = p.mediaUrls?.[0] ?? p.mediaUrl;
    return img ? <img key={p.id} src={img} alt="" className="aspect-square w-full object-cover" /> : <div key={p.id} className="aspect-square bg-indigo-50 p-2 text-[11px] text-gray-700 overflow-hidden">{p.caption}</div>;
  })}</div>;
}
