import { NavLink } from "react-router-dom";
import { Bell, Home, MessageCircle, Search, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
export default function BottomNav() {
  const { user } = useAuth(); const { unread } = useNotifications();
  const items = [["/", Home], ["/search", Search], ["/chat", MessageCircle], ["/notifications", Bell], [`/profile/${user?.id}`, User]];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="max-w-xl mx-auto flex justify-around py-2">
        {items.map(([to, Icon]) => (
          <li key={to}><NavLink to={to} end={to === "/"} className={({ isActive }) => `relative block p-2 ${isActive ? "text-indigo-600" : "text-gray-500"}`}>
            <Icon size={24} />{to === "/notifications" && unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
          </NavLink></li>
        ))}
      </ul>
    </nav>
  );
}
