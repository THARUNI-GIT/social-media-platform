import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Logo } from "../layouts/AppLayout";

export default function Register() {
  const { register } = useAuth(); const toast = useToast(); const nav = useNavigate();
  const [f, setF] = useState({ displayName: "", handle: "", email: "", password: "" }); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await register({ ...f, handle: f.handle.replace(/^@/, "").toLowerCase() }); nav("/", { replace: true }); } catch (err) { toast(err.message); } finally { setBusy(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[radial-gradient(1000px_500px_at_50%_-15%,rgba(99,102,241,.22),transparent_60%)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Join SocialPulse</h1>
          <p className="mt-1 text-sm text-gray-500">Share what's happening, in realtime.</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <input value={f.displayName} onChange={set("displayName")} placeholder="Display name" className="field" />
          <input value={f.handle} onChange={set("handle")} placeholder="@handle (a-z, 0-9, _)" autoCapitalize="none" className="field" />
          <input type="email" value={f.email} onChange={set("email")} placeholder="Email" autoComplete="email" className="field" />
          <input type="password" value={f.password} onChange={set("password")} placeholder="Password (min 8)" autoComplete="new-password" className="field" />
          <button disabled={busy || f.password.length < 8 || !f.handle || !f.email || !f.displayName} className="btn-primary">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Have an account? <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
