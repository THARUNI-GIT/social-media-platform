import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import ConversationList from "../components/chat/ConversationList";
import ChatWindow from "../components/chat/ChatWindow";
import MessageInput from "../components/chat/MessageInput";
import { createConversation, displayNameOf, listConversations, listMessages, resolveProfile } from "../services/chatService";
import { searchUsers } from "../services/usersService";
import { getUserId } from "../services/session";
import { connect, disconnect, emitTyping, markRead, onMessage, onPresence, onTyping, react, send } from "../websocket/socket";
import { ArrowLeft, Search, UserPlus } from "lucide-react";

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
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const activeRef = useRef(null);
  const seen = useRef(new Set());
  const typingState = useRef({ on: false, timer: null });
  activeRef.current = active;

  const loadUsers = useCallback(() => listConversations(getUserId()).then(setUsers).catch((e) => setError(e.message)), []);

  // Debounced people search so you start a chat by name/handle instead of pasting a UUID.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchUsers(term)
        .then((r) => { if (alive) setResults((r?.items ?? (Array.isArray(r) ? r : [])).slice(0, 6)); })
        .catch(() => { if (alive) setResults([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    loadUsers(); connect();
    const offs = [
      onMessage((m) => { if (!activeRef.current || m.conversationId === activeRef.current.conversationId) setMessages((p) => upsert(p, m)); if (m.text !== undefined) loadUsers(); }),
      onTyping(({ from, typing: t }) => { if (from === activeRef.current?.userId) setTyping(t); }),
      onPresence(({ userId, online }) => setUsers((p) => p.map((u) => (u.userId === userId ? { ...u, online } : u)))),
    ];
    return () => { offs.forEach((off) => off()); disconnect(); };
  }, [loadUsers]);

  const select = async (u) => {
    setActive(u); setMessages([]); setTyping(false); setError("");
    try { setMessages(await listMessages(u.id)); } catch (e) { setError(e.message); }
  };
  const start = async (userId) => {
    if (!userId) return;
    try {
      const c = await createConversation(userId);
      setQ(""); setResults([]);
      await loadUsers();
      const p = await resolveProfile(userId);
      select({ id: c.id, conversationId: c.id, userId, name: displayNameOf(p, userId), avatarUrl: p?.avatarUrl || null, online: false });
    } catch (e) { setError(e.message); }
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
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people to chat with"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-2 py-1.5 text-xs focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            {results.length > 0 && (
              <div className="rounded-lg border border-gray-100 divide-y overflow-hidden shadow-sm">
                {results.map((u) => (
                  <button key={u.id} onClick={() => start(u.id)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-indigo-50 transition">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {(u.displayName || u.handle || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-gray-900 truncate">{u.displayName || u.handle}</span>
                      <span className="block text-[10px] text-gray-500 truncate">@{u.handle}</span>
                    </span>
                    <UserPlus size={13} className="text-indigo-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
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
              <ChatWindow user={users.find((u) => u.id === active.id) || active} messages={messages} typing={typing} onSeen={onSeen} onReact={(messageId, emoji) => react(messageId, emoji)}>
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
