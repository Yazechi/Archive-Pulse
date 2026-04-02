import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    progress: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    progress: 'bg-amber-500',
  },
  info: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    progress: 'bg-cyan-500',
  },
};

const Toast = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  
  const { type = 'info', title, message, duration = 4000 } = toast;
  const colors = TOAST_COLORS[type] || TOAST_COLORS.info;
  const Icon = TOAST_ICONS[type] || Info;

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (duration <= 0) return;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(updateProgress);
      } else {
        dismiss();
      }
    };
    
    timerRef.current = requestAnimationFrame(updateProgress);
    
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [duration, dismiss]);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.4)] 
        transition-all duration-300 ease-out
        ${colors.bg} ${colors.border}
        ${isExiting 
          ? 'opacity-0 translate-x-full scale-95' 
          : 'opacity-100 translate-x-0 scale-100'
        }
      `}
      style={{ 
        minWidth: '320px',
        maxWidth: '420px',
      }}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div 
          className={`h-full transition-none ${colors.progress}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="p-4 pr-12">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            {title && (
              <p className="font-semibold text-white text-sm tracking-wide">
                {title}
              </p>
            )}
            {message && (
              <p className={`text-white/70 text-sm ${title ? 'mt-1' : ''}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Close button */}
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((options) => {
    const id = ++toastIdRef.current;
    const toast = typeof options === 'string' 
      ? { id, message: options, type: 'info' }
      : { id, ...options };
    
    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, options = {}) => {
    return addToast({ message, ...options });
  }, [addToast]);

  toast.success = useCallback((message, options = {}) => {
    return addToast({ message, type: 'success', title: 'Success', ...options });
  }, [addToast]);

  toast.error = useCallback((message, options = {}) => {
    return addToast({ message, type: 'error', title: 'Error', ...options });
  }, [addToast]);

  toast.warning = useCallback((message, options = {}) => {
    return addToast({ message, type: 'warning', title: 'Warning', ...options });
  }, [addToast]);

  toast.info = useCallback((message, options = {}) => {
    return addToast({ message, type: 'info', title: 'Info', ...options });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast, dismissToast }}>
      {children}
      
      {/* Toast container */}
      <div 
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
        style={{ maxHeight: 'calc(100vh - 32px)' }}
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};

export default ToastContext;
