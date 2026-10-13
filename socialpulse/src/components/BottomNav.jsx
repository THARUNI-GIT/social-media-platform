import { NavLink } from "react-router-dom";
import { Bell, Home, MessageCircle, Search, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";

export default function BottomNav() {
  const { user } = useAuth(); const { unread } = useNotifications();
  const items = [["/", Home], ["/search", Search], ["/chat", MessageCircle], ["/notifications", Bell], [`/profile/${user?.id}`, User]];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200/70 bg-white/85 backdrop-blur-md shadow-nav pb-[env(safe-area-inset-bottom)]">
      <ul className="max-w-xl mx-auto flex justify-around py-2">
        {items.map(([to, Icon]) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex items-center justify-center rounded-full transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-indigo-500"}`
              }
              style={({ isActive }) => ({ width: 44, height: 36, background: isActive ? "rgba(99,102,241,.10)" : "transparent" })}
            >
              <Icon size={22} strokeWidth={2.1} />
              {to === "/notifications" && unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white ring-2 ring-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
