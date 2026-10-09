import { io } from "socket.io-client";
import { getToken } from "../services/session";
let socket = null;
export function connectNotifications({ onNew, onUnread }) {
  socket?.disconnect();
  socket = io(import.meta.env.VITE_NOTIFY_URL, { path: "/notifications/socket.io", auth: (cb) => cb({ token: getToken() }) });
  socket.on("notification:new", ({ notification }) => onNew(notification));
  socket.on("notification:unread", ({ count }) => onUnread(count));
  return () => { socket?.disconnect(); socket = null; };
}
