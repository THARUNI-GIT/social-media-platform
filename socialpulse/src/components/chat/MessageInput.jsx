import { useState } from "react";
import { Send } from "lucide-react";

export default function MessageInput({ onChange, onSend }) {
  const [text, setText] = useState("");

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    onChange?.(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText("");
    onChange?.("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t bg-white flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Type a message..."
        className="flex-1 rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
      >
        <Send size={14} />
      </button>
    </form>
  );
}
