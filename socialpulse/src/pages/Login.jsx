import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Page } from "../components/ui";
export default function Login() {
  const { login } = useAuth(); const toast = useToast(); const nav = useNavigate(); const from = useLocation().state?.from || "/";
  const [id, setId] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await login(id, pw); nav(from, { replace: true }); } catch (err) { toast(err.message); } finally { setBusy(false); } };
  return (
    <Page><h1 className="text-2xl font-bold pt-10">Welcome back</h1>
      <form onSubmit={submit} className="space-y-3">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Email or handle" autoComplete="username" className="w-full rounded-xl border px-3 py-3 text-base" />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full rounded-xl border px-3 py-3 text-base" />
        <button disabled={busy || !id || !pw} className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-sm text-gray-500">New here? <Link to="/register" className="text-indigo-600">Create an account</Link></p>
    </Page>
  );
}
