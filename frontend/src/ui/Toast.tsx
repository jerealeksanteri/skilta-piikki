import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ShowToast } from './toastContext';
import { aboveNav, fontSize, radius, zIndex } from './tokens';

const DEFAULT_DURATION_MS = 2500;

/** Owns the app's single toast; pages show one with useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<ShowToast>((text, durationMs = DEFAULT_DURATION_MS) => {
    // Restart the timer, so an earlier toast's timeout can't hide this one early.
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(null), durationMs);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: aboveNav,
            left: '50%',
            transform: 'translateX(-50%)',
            // As wide as the text, but wrapping instead of running off narrow screens.
            width: 'max-content',
            maxWidth: 'calc(100vw - 32px)',
            textAlign: 'center',
            backgroundColor: 'var(--text)',
            color: 'var(--bg)',
            padding: '10px 20px',
            borderRadius: radius.pill,
            fontSize: fontSize.base,
            fontWeight: 500,
            zIndex: zIndex.toast,
          }}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
