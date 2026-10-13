import { useCallback, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { adminOverview, adminReports, adminResolve, adminSuspend, adminUsers } from "../services/usersService";
import { getPost } from "../services/postsService";
import { ListSkeleton } from "../components/ui";

const shortId = (id) => (id ? `${id.slice(0, 8)}…` : "—");

function ReportCard({ r, onResolve }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (r.targetType !== "post") return;
    let alive = true;
    getPost(r.targetId).then((p) => { if (alive) setPreview(p?.caption || null); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  }, [r.targetId, r.targetType]);

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-card space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">{r.targetType}</span>
        <span className="text-sm text-gray-600">reported for <b className="text-gray-900">{r.reason}</b></span>
      </div>
      {preview
        ? <p className="line-clamp-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">“{preview}”</p>
        : <p className="text-xs text-gray-400">Target <span className="font-mono">{shortId(r.targetId)}</span> (content may already be removed)</p>}
      {r.details && <p className="text-xs text-gray-500">{r.details}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onResolve(r, "remove")} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white transition hover:bg-red-500">Remove content</button>
        <button onClick={() => onResolve(r, "dismiss")} className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50">Dismiss</button>
      </div>
    </div>
  );
}

export default function Admin() {
  const toast = useToast(); const [tab, setTab] = useState("reports"); const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null); const [users, setUsers] = useState(null); const [q, setQ] = useState("");
  const loadReports = useCallback(() => adminReports().then((r) => setReports(r.items)).catch((e) => toast(e.message)), []);
  useEffect(() => { adminOverview().then(setStats).catch(() => {}); loadReports(); }, [loadReports]);
  useEffect(() => { if (tab !== "users") return; const t = setTimeout(() => adminUsers(q).then((r) => setUsers(r.items)).catch((e) => toast(e.message)), 250); return () => clearTimeout(t); }, [tab, q]);
  const resolve = async (r, action) => { setReports((p) => p.filter((x) => x.id !== r.id)); try { await adminResolve(r.id, action); toast(action === "remove" ? "Content removed" : "Report dismissed", "info"); adminOverview().then(setStats).catch(() => {}); } catch (e) { toast(e.message); loadReports(); } };
  const suspend = async (u) => { const on = !u.suspended; setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, suspended: on } : x))); try { await adminSuspend(u.id, on); } catch (e) { toast(e.message); setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, suspended: !on } : x))); } };

  const tiles = [["Users", stats?.users?.users], ["Suspended", stats?.users?.suspended], ["Open reports", stats?.content?.openReports]];
  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      <h1 className="text-lg font-bold tracking-tight">Admin</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        {tiles.map(([l, v], i) => (
          <div key={l} className="rounded-2xl border border-gray-200/70 bg-white p-3 shadow-card">
            <p className={`text-xl font-bold ${i === 2 && (v ?? 0) > 0 ? "text-amber-500" : "text-gray-900"}`}>{v ?? "–"}</p>
            <p className="text-xs text-gray-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1 rounded-xl border border-gray-200/70 bg-white p-1 shadow-sm">
        {["reports", "users"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>{t}</button>
        ))}
      </div>

      {tab === "reports" && (reports ? (reports.length ? <div className="space-y-3">{reports.map((r) => <ReportCard key={r.id} r={r} onResolve={resolve} />)}</div> : <p className="text-sm text-gray-400">No open reports.</p>) : <ListSkeleton />)}

      {tab === "users" && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search handle, name, email" className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100" />
          {!users ? (
            <ListSkeleton />
          ) : users.length ? (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-card">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      @{u.handle}{' '}
                      {u.suspended && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-500">suspended</span>}
                    </p>
                    <p className="truncate text-xs text-gray-500">{u.displayName || "—"} · {u.email}</p>
                  </div>
                  <button onClick={() => suspend(u)} className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${u.suspended ? "border-indigo-200 text-indigo-600 hover:bg-indigo-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}>
                    {u.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No users match.</p>
          )}
        </>
      )}
    </div>
  );
}
