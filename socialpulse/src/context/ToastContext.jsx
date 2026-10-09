import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
const Ctx = createContext(() => {}); export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "error") => {
    const id = Math.random().toString(36).slice(2); setItems((p) => [...p, { id, message, type }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed top-3 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence>{items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`pointer-events-auto rounded-xl px-4 py-2 text-sm text-white shadow-lg ${t.type === "error" ? "bg-red-600" : "bg-gray-900"}`}>{t.message}</motion.div>
        ))}</AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
