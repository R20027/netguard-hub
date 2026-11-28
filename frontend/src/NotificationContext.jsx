import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', title = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    
    // Auto-clean emoji prefixes if present in legacy strings
    let cleanMsg = typeof message === 'string' ? message : String(message);
    let inferredType = type;
    if (cleanMsg.startsWith('✅')) {
      inferredType = 'success';
      cleanMsg = cleanMsg.replace(/^✅\s*/, '');
    } else if (cleanMsg.startsWith('❌') || cleanMsg.startsWith('⛔')) {
      inferredType = 'error';
      cleanMsg = cleanMsg.replace(/^[❌⛔]\s*/, '');
    } else if (cleanMsg.startsWith('⚠️')) {
      inferredType = 'warning';
      cleanMsg = cleanMsg.replace(/^⚠️\s*/, '');
    } else if (cleanMsg.startsWith('🔒') || cleanMsg.startsWith('⚡') || cleanMsg.startsWith('📡') || cleanMsg.startsWith('🔄')) {
      cleanMsg = cleanMsg.replace(/^[🔒⚡📡🔄]\s*/, '');
    }

    const toast = {
      id,
      message: cleanMsg,
      type: inferredType,
      title: title || (inferredType === 'success' ? 'Sukses' : inferredType === 'error' ? 'Terjadi Kesalahan' : inferredType === 'warning' ? 'Perhatian' : 'Informasi'),
    };

    setToasts((prev) => [...prev.slice(-4), toast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const confirmModal = useCallback(({ title, message, confirmText = 'Lanjutkan', cancelText = 'Batal', isDestructive = false }) => {
    return new Promise((resolve) => {
      // Auto-clean emoji prefixes if present
      let cleanMsg = typeof message === 'string' ? message : String(message);
      let cleanTitle = title;
      if (cleanMsg.startsWith('⚠️')) {
        cleanMsg = cleanMsg.replace(/^⚠️\s*/, '');
        if (!cleanTitle) cleanTitle = 'Konfirmasi Tindakan';
      }

      setConfirmState({
        title: cleanTitle || (isDestructive ? 'Hapus / Putuskan Konfirmasi' : 'Konfirmasi Tindakan'),
        message: cleanMsg,
        confirmText,
        cancelText,
        isDestructive,
        resolve: (val) => {
          setConfirmState(null);
          resolve(val);
        },
      });
    });
  }, []);

  // Pasang window bridge agar semua panggilan alert & confirm lama langsung menggunakan UI modern ini
  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (msg) => {
      showToast(msg);
    };

    window.confirmModal = confirmModal;

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [showToast, confirmModal]);

  return (
    <NotificationContext.Provider value={{ showToast, confirmModal }}>
      {children}

      {/* TOAST CONTAINER */}
      <div className="fixed top-4 right-4 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const typeStyles = {
            success: {
              border: 'border-emerald-800/80 bg-slate-900/95 text-emerald-300',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
              badge: 'bg-emerald-500/20 text-emerald-300',
            },
            error: {
              border: 'border-rose-800/80 bg-slate-900/95 text-rose-300',
              icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
              badge: 'bg-rose-500/20 text-rose-300',
            },
            warning: {
              border: 'border-amber-800/80 bg-slate-900/95 text-amber-300',
              icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
              badge: 'bg-amber-500/20 text-amber-300',
            },
            info: {
              border: 'border-cyan-800/80 bg-slate-900/95 text-cyan-300',
              icon: <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />,
              badge: 'bg-cyan-500/20 text-cyan-300',
            },
          }[t.type] || {
            border: 'border-slate-800 bg-slate-900/95 text-slate-200',
            icon: <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />,
            badge: 'bg-slate-700/50 text-slate-300',
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border ${typeStyles.border} shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-top-3`}
            >
              {typeStyles.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-xs font-bold text-white tracking-tight">{t.title}</h5>
                  <button
                    onClick={() => removeToast(t.id)}
                    className="text-slate-400 hover:text-white p-0.5 rounded transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-line leading-relaxed break-words font-sans">
                  {t.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[9999999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => confirmState.resolve(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left font-sans text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmState.isDestructive
                    ? 'bg-rose-950/80 border-rose-800 text-rose-400'
                    : 'bg-cyan-950/80 border-cyan-800 text-cyan-400'
                }`}
              >
                {confirmState.isDestructive ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <HelpCircleModal className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {confirmState.title}
                </h4>
                <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed font-sans">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-4 py-2 rounded-xl font-bold text-xs shadow-md transition ${
                  confirmState.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/30'
                }`}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

function HelpCircleModal({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function useToast() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      showToast: (msg) => typeof window !== 'undefined' && window.alert(msg),
      confirmModal: ({ message }) => Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : true),
    };
  }
  return ctx;
}
