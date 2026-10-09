import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { block, listBlocks, updateMe } from "../services/usersService";
import { uploadImage } from "../services/mediaService";
import { Avatar, Page } from "../components/ui";
export default function Settings() {
  const { user, updateUser, logout } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [name, setName] = useState(user.displayName); const [bio, setBio] = useState(user.bio || ""); const [busy, setBusy] = useState(false); const [blocked, setBlocked] = useState([]);
  useEffect(() => { listBlocks().then((r) => setBlocked(r.items)).catch(() => {}); }, []);
  const save = async () => { setBusy(true); try { updateUser(await updateMe({ displayName: name, bio })); toast("Saved", "info"); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const pick = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await uploadImage(f, "avatar"); updateUser(await updateMe({ avatarUrl: url })); } catch (err) { toast(err.message); } };
  const unblock = async (id) => { setBlocked((p) => p.filter((u) => u.id !== id)); try { await block(id, false); } catch (e) { toast(e.message); } };
  return (
    <Page><h1 className="text-lg font-bold">Settings</h1>
      <label className="flex items-center gap-4"><Avatar user={user} size={64} /><span className="text-sm text-indigo-600">Change photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" /></label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className="w-full rounded-xl border px-3 py-3" />
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} placeholder="Bio" className="w-full rounded-xl border px-3 py-3" />
      <button onClick={save} disabled={busy || !name.trim()} className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      <h2 className="font-semibold pt-2">Blocked users</h2>
      {!blocked.length ? <p className="text-sm text-gray-400">No blocked users.</p> : blocked.map((u) => <div key={u.id} className="flex items-center justify-between text-sm"><span>@{u.handle}</span><button onClick={() => unblock(u.id)} className="text-indigo-600">Unblock</button></div>)}
      {user.roles?.includes("admin") && <button onClick={() => nav("/admin")} className="w-full rounded-xl border py-3 text-sm">Admin dashboard</button>}
      <button onClick={logout} className="w-full rounded-xl border py-3 text-sm text-red-600">Log out</button>
    </Page>
  );
}
