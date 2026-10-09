import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Page } from "../components/ui";
export default function Register() {
  const { register } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [f, setF] = useState({ displayName: "", handle: "", email: "", password: "" }); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await register({ ...f, handle: f.handle.replace(/^@/, "").toLowerCase() }); nav("/", { replace: true }); } catch (err) { toast(err.message); } finally { setBusy(false); } };
  const input = "w-full rounded-xl border px-3 py-3 text-base";
  return (
    <Page><h1 className="text-2xl font-bold pt-10">Join SocialPulse</h1>
      <form onSubmit={submit} className="space-y-3">
        <input value={f.displayName} onChange={set("displayName")} placeholder="Display name" className={input} />
        <input value={f.handle} onChange={set("handle")} placeholder="@handle (a-z, 0-9, _)" autoCapitalize="none" className={input} />
        <input type="email" value={f.email} onChange={set("email")} placeholder="Email" autoComplete="email" className={input} />
        <input type="password" value={f.password} onChange={set("password")} placeholder="Password (min 8)" autoComplete="new-password" className={input} />
        <button disabled={busy || f.password.length < 8 || !f.handle || !f.email || !f.displayName} className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="text-sm text-gray-500">Have an account? <Link to="/login" className="text-indigo-600">Sign in</Link></p>
    </Page>
  );
}
