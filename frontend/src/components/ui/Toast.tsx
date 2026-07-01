import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

let toastId = 0;
const listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify(message: string, type: Toast['type'] = 'info') {
  const toast = { id: ++toastId, message, type };
  toasts = [...toasts, toast];
  listeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    listeners.forEach((l) => l(toasts));
  }, 4000);
}

export const toast = {
  success: (msg: string) => notify(msg, 'success'),
  error: (msg: string) => notify(msg, 'error'),
  info: (msg: string) => notify(msg, 'info'),
};

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => { listeners.splice(listeners.indexOf(setItems), 1); };
  }, []);

  const colors = {
    success: 'bg-dark-card border-emerald-500/30 text-emerald-300',
    error: 'bg-dark-card border-red-500/30 text-red-300',
    info: 'bg-dark-card border-dark-border text-text-primary',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {items.map((t) => (
        <div key={t.id} className={clsx('flex items-center gap-3 rounded-md border px-4 py-3 shadow-lg min-w-[280px] text-sm transition-all duration-status', colors[t.type])}>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}>
            <X className="h-4 w-4 opacity-60" />
          </button>
        </div>
      ))}
    </div>
  );
}
