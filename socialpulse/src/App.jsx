import { AnimatePresence } from "framer-motion";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import BottomNav from "./components/BottomNav";
import { Skeleton } from "./components/ui";
import Home from "./pages/Home"; import Chat from "./pages/Chat"; import Login from "./pages/Login"; import Register from "./pages/Register";
import Profile from "./pages/Profile"; import Search from "./pages/Search"; import Explore from "./pages/Explore"; import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings"; import Admin from "./pages/Admin";

function Protected({ admin = false }) {
  const { user, ready, isAdmin } = useAuth(); const loc = useLocation();
  if (!ready) return <div className="p-6"><Skeleton className="h-8 w-1/2" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <NotificationsProvider><Outlet /><BottomNav /></NotificationsProvider>;
}
function Guest() {
  const { user, ready } = useAuth();
  if (!ready) return null; // still validating a stored session - avoids flashing the login form
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

export default function App() {
  const loc = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={loc} key={loc.pathname.split("/")[1]}>
        <Route element={<Guest />}><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /></Route>
        <Route element={<Protected />}>
          <Route path="/" element={<Home />} /><Route path="/chat" element={<Chat />} /><Route path="/search" element={<Search />} />
          <Route path="/profile/:id" element={<Profile />} /><Route path="/explore/:tag" element={<Explore />} /><Route path="/bookmarks" element={<Explore bookmarks />} />
          <Route path="/notifications" element={<Notifications />} /><Route path="/settings" element={<Settings />} />
        </Route>
        <Route element={<Protected admin />}><Route path="/admin" element={<Admin />} /></Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
