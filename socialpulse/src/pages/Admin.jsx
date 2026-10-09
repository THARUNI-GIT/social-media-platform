import { useCallback, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { adminOverview, adminReports, adminResolve, adminSuspend, adminUsers } from "../services/usersService";
import { ListSkeleton, Page } from "../components/ui";
export default function Admin() {
  const toast = useToast(); const [tab, setTab] = useState("reports"); const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null); const [users, setUsers] = useState(null); const [q, setQ] = useState("");
  const loadReports = useCallback(() => adminReports().then((r) => setReports(r.items)).catch((e) => toast(e.message)), []);
  useEffect(() => { adminOverview().then(setStats).catch(() => {}); loadReports(); }, []);
  useEffect(() => { if (tab !== "users") return; const t = setTimeout(() => adminUsers(q).then((r) => setUsers(r.items)).catch((e) => toast(e.message)), 250); return () => clearTimeout(t); }, [tab, q]);
  const resolve = async (r, action) => { setReports((p) => p.filter((x) => x.id !== r.id)); try { await adminResolve(r.id, action); } catch (e) { toast(e.message); loadReports(); } };
  const suspend = async (u) => { const on = !u.suspended; setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, suspended: on } : x))); try { await adminSuspend(u.id, on); } catch (e) { toast(e.message); setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, suspended: !on } : x))); } };
  return (
    <Page><h1 className="text-lg font-bold">Admin</h1>
      <div className="grid grid-cols-3 gap-2 text-center">{[["Users", stats?.users?.users], ["Suspended", stats?.users?.suspended], ["Open reports", stats?.content?.openReports]].map(([l, v]) => <div key={l} className="rounded-xl border bg-white p-3"><p className="text-xl font-bold">{v ?? "–"}</p><p className="text-xs text-gray-500">{l}</p></div>)}</div>
      <div className="flex gap-2">{["reports", "users"].map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2 text-sm capitalize ${tab === t ? "bg-indigo-600 text-white" : "border"}`}>{t}</button>)}</div>
      {tab === "reports" && (reports ? (reports.length ? reports.map((r) => (
        <div key={r.id} className="rounded-xl border bg-white p-3 text-sm space-y-2"><p><b>{r.targetType}</b> reported for <b>{r.reason}</b></p>{r.details && <p className="text-gray-600">{r.details}</p>}<p className="text-xs text-gray-400 break-all">{r.targetId}</p>
          <div className="flex gap-2"><button onClick={() => resolve(r, "remove")} className="flex-1 rounded-lg bg-red-600 py-1.5 text-white">Remove content</button><button onClick={() => resolve(r, "dismiss")} className="flex-1 rounded-lg border py-1.5">Dismiss</button></div></div>
      )) : <p className="text-sm text-gray-400">No open reports.</p>) : <ListSkeleton />)}
      {tab === "users" && <><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search handle, name, email" className="w-full rounded-xl border px-3 py-2 text-sm" />
        {users ? users.map((u) => <div key={u.id} className="flex items-center justify-between text-sm"><span>@{u.handle} <span className="text-gray-400">{u.email}</span></span><button onClick={() => suspend(u)} className={u.suspended ? "text-indigo-600" : "text-red-600"}>{u.suspended ? "Unsuspend" : "Suspend"}</button></div>) : <ListSkeleton />}</>}
    </Page>
  );
}
