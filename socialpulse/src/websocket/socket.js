import { io } from "socket.io-client";
import { getToken, getUserId } from "../services/session";
import { mapMessage } from "../services/chatService";

let socket = null;
const subs = { message: new Set(), typing: new Set(), presence: new Set() };
const sub = (set) => (fn) => { set.add(fn); return () => set.delete(fn); };
const fire = (set, v) => set.forEach((fn) => fn(v));

// Swap for: io(VITE_CHAT_URL, { auth: { token } })
export function connect() {
  if (socket) return socket;
  socket = io(import.meta.env.VITE_CHAT_URL, { auth: (cb) => cb({ token: getToken() }) });

  socket.on("message:new", ({ message }) => fire(subs.message, mapMessage(message)));
  // Partial updates: same id + changed fields. The page upserts (merges) by id.
  socket.on("message:read:update", ({ conversationId, messageId, userId }) => {
    if (userId !== getUserId()) fire(subs.message, { id: messageId, conversationId, status: "read" });
  });
  socket.on("message:reaction:update", ({ messageId, reactions }) => fire(subs.message, { id: messageId, reactions }));
  socket.on("message:typing", ({ userId, isTyping }) => fire(subs.typing, { from: userId, typing: isTyping }));
  socket.on("presence:update", ({ userId, status }) => fire(subs.presence, { userId, online: status === "online" }));
  return socket;
}
export function disconnect() { socket?.disconnect(); socket = null; }
export function send({ conversationId, text }) {
  socket?.emit("message:send", { conversationId, type: "text", content: text });
}
export const onMessage = sub(subs.message);
export const onTyping = sub(subs.typing);
export const onPresence = sub(subs.presence);
export function emitTyping(conversationId, isTyping) {
  socket?.emit(isTyping ? "message:typing:start" : "message:typing:stop", { conversationId });
}
export function markRead(conversationId, messageId) { socket?.emit("message:read", { conversationId, messageId }); }
