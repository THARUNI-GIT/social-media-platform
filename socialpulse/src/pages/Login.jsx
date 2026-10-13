import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Logo } from "../layouts/AppLayout";

export default function Login() {
  const { login } = useAuth(); const toast = useToast(); const nav = useNavigate(); const from = useLocation().state?.from || "/";
  const [id, setId] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await login(id, pw); nav(from, { replace: true }); } catch (err) { toast(err.message); } finally { setBusy(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[radial-gradient(1000px_500px_at_50%_-15%,rgba(99,102,241,.22),transparent_60%)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to catch up on what's happening.</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Email or handle" autoComplete="username" className="field" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" className="field" />
          <button disabled={busy || !id || !pw} className="btn-primary">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          New here? <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">Create an account</Link>
        </p>
        <p className="mt-6 text-center text-[11px] text-gray-400">Demo accounts: alice · bob · carol · admin — password <span className="font-mono">password123</span></p>
      </div>
    </div>
  );
}
