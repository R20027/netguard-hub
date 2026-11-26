import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * HelpTip - Komponen Tanda Seru Bulat (!) Interaktif
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
        title={`Penjelasan: ${title || 'Klik untuk melihat penjelasan fungsi'}`}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/95 hover:bg-cyan-600 active:bg-cyan-700 border border-slate-600 hover:border-cyan-300 text-cyan-300 hover:text-white text-[11px] font-black cursor-pointer transition-all duration-150 select-none shadow-sm flex-shrink-0 ml-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400/70 ${className}`}
      >
        !
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm sm:max-w-md w-full p-5 shadow-2xl space-y-3.5 text-left font-sans text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-cyan-950 border-2 border-cyan-500 text-cyan-300 flex items-center justify-center text-sm font-black shadow-inner flex-shrink-0">
                    !
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white tracking-tight">
                      {title || 'Penjelasan Fungsi'}
                    </h4>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      Panduan Tombol &amp; Fitur GuardHub
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="text-xs text-slate-200 leading-relaxed space-y-2.5">
                <p>{text}</p>

                {impact && (
                  <div className="bg-rose-950/50 border border-rose-800/70 rounded-xl p-2.5 text-rose-200 text-[11px] flex items-start gap-2">
                    <span className="text-sm">⚠️</span>
                    <div>
                      <strong className="block text-rose-300 font-semibold mb-0.5">
                        Dampak / Efek Tindakan:
                      </strong>
                      <span>{impact}</span>
                    </div>
                  </div>
                )}

                {tip && (
                  <div className="bg-cyan-950/50 border border-cyan-800/70 rounded-xl p-2.5 text-cyan-200 text-[11px] flex items-start gap-2">
                    <span className="text-sm">💡</span>
                    <div>
                      <strong className="block text-cyan-300 font-semibold mb-0.5">
                        Tips Penggunaan:
                      </strong>
                      <span>{tip}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold text-xs shadow-md shadow-cyan-600/25 transition"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
