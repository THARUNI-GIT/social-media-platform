export default function ConversationList({ users = [], activeId, onSelect }) {
  if (!users.length) {
    return <p className="p-4 text-xs text-gray-400">No conversations yet.</p>;
  }

  return (
    <div className="divide-y">
      {users.map((u) => {
        const active = u.id === activeId;
        return (
          <button
            key={u.id || u.conversationId}
            onClick={() => onSelect(u)}
            className={`w-full text-left p-3 flex items-center gap-3 transition hover:bg-gray-50 ${active ? "bg-indigo-50/50 border-l-4 border-indigo-600" : ""}`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs">
                {(u.name || "U").slice(0, 2).toUpperCase()}
              </div>
              {u.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-gray-900">{u.name || u.id}</p>
              {u.lastMessage && <p className="text-[11px] text-gray-500 truncate">{u.lastMessage}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
