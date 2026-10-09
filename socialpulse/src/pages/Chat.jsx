import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import ConversationList from "../components/chat/ConversationList";
import ChatWindow from "../components/chat/ChatWindow";
import MessageInput from "../components/chat/MessageInput";
import { createConversation, listConversations, listMessages } from "../services/chatService";
import { connect, disconnect, emitTyping, markRead, onMessage, onPresence, onTyping, send } from "../websocket/socket";
import { ArrowLeft } from "lucide-react";

// Merge a full or partial message into the list by id (partials for unknown ids are ignored).
const upsert = (list, m) => {
  const i = list.findIndex((x) => x.id === m.id);
  if (i === -1) return m.text !== undefined ? [...list, m].sort((a, b) => a.ts - b.ts) : list;
  const next = list.slice(); next[i] = { ...list[i], ...m }; return next;
};

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [newId, setNewId] = useState("");
  const activeRef = useRef(null);
  const seen = useRef(new Set());
  const typingState = useRef({ on: false, timer: null });
  activeRef.current = active;

  const loadUsers = useCallback(() => listConversations().then(setUsers).catch((e) => setError(e.message)), []);

  useEffect(() => {
    loadUsers(); connect();
    const offs = [
      onMessage((m) => { if (!activeRef.current || m.conversationId === activeRef.current.conversationId) setMessages((p) => upsert(p, m)); if (m.text !== undefined) loadUsers(); }),
      onTyping(({ from, typing: t }) => { if (from === activeRef.current?.id) setTyping(t); }),
      onPresence(({ userId, online }) => setUsers((p) => p.map((u) => (u.id === userId ? { ...u, online } : u)))),
    ];
    return () => { offs.forEach((off) => off()); disconnect(); };
  }, [loadUsers]);

  const select = async (u) => {
    setActive(u); setMessages([]); setTyping(false); setError("");
    try { setMessages(await listMessages(u.id)); } catch (e) { setError(e.message); }
  };
  const start = async () => {
    const id = newId.trim(); if (!id) return;
    try { const c = await createConversation(id); setNewId(""); await loadUsers(); select({ id, name: `User ${id.slice(0, 6)}`, online: false, conversationId: c.id }); } catch (e) { setError(e.message); }
  };

  // debounced typing: start on first keystroke, stop after 1.5s idle or when input empties
  const onInput = (text) => {
    if (!active) return; const s = typingState.current; clearTimeout(s.timer);
    if (text && !s.on) { s.on = true; emitTyping(active.conversationId, true); }
    const stop = () => { if (s.on) { s.on = false; emitTyping(active.conversationId, false); } };
    if (!text) stop(); else s.timer = setTimeout(stop, 1500);
  };
  const onSeen = useCallback((m) => {
    if (seen.current.has(m.id) || !activeRef.current) return;
    seen.current.add(m.id); markRead(activeRef.current.conversationId, m.id);
  }, []);

  return (
    <AppLayout>
      <div className="flex h-[70vh] rounded-2xl border bg-white overflow-hidden">
        <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r flex-col`}>
          <div className="p-3 border-b flex gap-2">
            <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Start chat by user id" className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-xs" />
            <button onClick={start} className="px-2 rounded-lg bg-indigo-600 text-white text-xs">Go</button>
          </div>
          <div className="flex-1 overflow-y-auto"><ConversationList users={users} activeId={active?.id} onSelect={select} /></div>
        </aside>
        <section className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
          {active ? (
            <div className="flex flex-col h-full">
              <div className="md:hidden border-b p-2">
                <button onClick={() => setActive(null)} className="flex items-center text-sm text-indigo-600">
                  <ArrowLeft size={16} className="mr-1" /> Back
                </button>
              </div>
              <ChatWindow user={users.find((u) => u.id === active.id) || active} messages={messages} typing={typing} onSeen={onSeen}>
                <MessageInput onChange={onInput} onSend={(text) => { send({ conversationId: active.conversationId, text }); onInput(""); }} />
              </ChatWindow>
            </div>
          ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">Select a conversation</div>}
          {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}
        </section>
      </div>
    </AppLayout>
  );
}
