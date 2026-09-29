import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '../lib/cx';
import s from './Toast.module.css';

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number>(undefined);

  const toast = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    setVisible(true);
    timer.current = window.setTimeout(() => setVisible(false), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toast" role="status" aria-live="polite" className={cx(s.toast, visible && s.visible)}>
        {message}
      </div>
    </ToastContext.Provider>
  );
}
