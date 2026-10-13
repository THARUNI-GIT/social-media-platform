import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, SmilePlus } from "lucide-react";
import { getUserId } from "../../services/session";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function ChatWindow({ user, messages = [], typing = false, onSeen, onReact, children }) {
  const currentUserId = getUserId();
  const bottomRef = useRef(null);
  const [picker, setPicker] = useState(null); // message id the picker is open for

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    messages.forEach((m) => {
      if (m.senderId !== currentUserId) {
        onSeen?.(m);
      }
    });
  }, [messages, currentUserId, onSeen]);

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="p-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs">
              {(user?.name || "U").slice(0, 2).toUpperCase()}
            </div>
            {user?.online && <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />}
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900">{user?.name || user?.id}</h3>
            <p className="text-[10px] text-gray-500">{user?.online ? "Online" : "Offline"}</p>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`group/msg flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="relative">
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                    isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-900 border rounded-bl-none"
                  }`}
                >
                  <p>{m.text}</p>
                  {!!m.reactions?.length && (
                    <div className="flex gap-1 mt-1 pt-1 border-t border-white/20">
                      {m.reactions.map((r, i) => (
                        <span key={i} className="text-[10px]">{r.emoji}</span>
                      ))}
                    </div>
                  )}
                  <div className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                    <span>{new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {isMe && (
                      <span>
                        {m.status === "read" ? (
                          <CheckCheck size={12} className="text-sky-300" />
                        ) : m.status === "delivered" ? (
                          <CheckCheck size={12} />
                        ) : (
                          <Check size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {onReact && (
                  <button
                    onClick={() => setPicker((p) => (p === m.id ? null : m.id))}
                    title="React"
                    className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "-left-7" : "-right-7"} hidden rounded-full p-1 text-gray-400 transition hover:bg-white hover:text-indigo-600 group-hover/msg:block`}
                  >
                    <SmilePlus size={14} />
                  </button>
                )}
                {picker === m.id && onReact && (
                  <div className="absolute z-10 top-full mt-1 flex gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-card">
                    {QUICK_REACTIONS.map((e) => (
                      <button key={e} onClick={() => { onReact(m.id, e); setPicker(null); }} className="text-sm transition hover:scale-125">{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 italic">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]" />
            <span>typing...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {children}
    </div>
  );
}
