import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, Moon, Search, Shield, Sun, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AppLayout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            SocialPulse
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/admin" className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="Admin">
                <Shield size={18} />
              </Link>
            )}
            <Link to="/search" className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="Search">
              <Search size={18} />
            </Link>
            <Link to="/chat" className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="Chat">
              <MessageCircle size={18} />
            </Link>
            <Link to={`/profile/${user?.id}`} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="Profile">
              <User size={18} />
            </Link>
            <button onClick={() => { logout(); navigate("/login"); }} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" title="Logout">
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
