// Toast.tsx
import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const ToastContext = createContext<{
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const icons = {
    info: <Info size={18} />,
    success: <CheckCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    error: <XCircle size={18} />,
  };

  const colors = {
    info: 'border-accent/30 bg-accent/10 text-accent',
    success: 'border-green-500/30 bg-green-500/10 text-green-400',
    warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl min-w-[300px] max-w-[400px] ${colors[toast.type]}`}
            >
              {icons[toast.type]}
              <span className="text-sm flex-1">{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="p-0.5 rounded-full hover:bg-white/10">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};