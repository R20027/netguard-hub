import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, AlertTriangle, Lightbulb, X } from 'lucide-react';

/**
 * HelpTip - Komponen Bantuan Informatif Enterprise (Anti-Slop)
 * Menggunakan createPortal ke document.body agar penjelasan tidak pernah
 * terpotong oleh parent container dengan overflow-hidden / backdrop-blur.
 */
export default function HelpTip({ title, text, impact, tip, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  const handleClose = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Penjelasan: ${title || 'Info fitur'}`}
        title={`Penjelasan: ${title || 'Klik untuk melihat panduan fitur'}`}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/80 hover:bg-cyan-950/80 active:bg-cyan-900 border border-slate-700/80 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300 transition-colors duration-150 select-none shadow-sm flex-shrink-0 ml-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-left font-sans text-slate-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white tracking-tight">
                      {title || 'Penjelasan Fitur'}
                    </h4>
                    <span className="text-[10px] text-cyan-400 font-mono tracking-wider">
                      NETGUARD HUB KNOWLEDGE BASE
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="text-xs text-slate-200 leading-relaxed space-y-3 font-sans">
                <p className="text-slate-300">{text}</p>

                {impact && (
                  <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-300 font-semibold mb-0.5 text-[11px] uppercase tracking-wider">
                        Dampak Tindakan:
                      </strong>
                      <span className="text-slate-300">{impact}</span>
                    </div>
                  </div>
                )}

                {tip && (
                  <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-xl p-3 text-cyan-200 text-xs flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-cyan-300 font-semibold mb-0.5 text-[11px] uppercase tracking-wider">
                        Rekomendasi NOC:
                      </strong>
                      <span className="text-slate-300">{tip}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
