import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, Search, Shield, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/** Brand mark: gradient tile with a pulse glyph. Shared by the header and the auth screens. */
export function Logo({ size = 30 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 13h4l2.5-6 4 12 2.5-6H22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AppLayout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-gray-900 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              SocialPulse
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link to="/admin" className="icon-btn" title="Admin">
                <Shield size={18} />
              </Link>
            )}
            <Link to="/search" className="icon-btn" title="Search">
              <Search size={18} />
            </Link>
            <Link to="/chat" className="icon-btn" title="Chat">
              <MessageCircle size={18} />
            </Link>
            <Link to={`/profile/${user?.id}`} className="flex items-center gap-2 rounded-full p-1 pr-2.5 transition hover:bg-indigo-50" title="Profile">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                  {(user?.displayName || user?.handle || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:block max-w-[10rem] truncate text-sm font-medium text-gray-700">
                {user?.displayName || user?.handle}
              </span>
            </Link>
            <button onClick={() => { logout(); navigate("/login"); }} className="icon-btn" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
