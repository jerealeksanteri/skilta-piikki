import { useEffect, useState, type ReactNode } from 'react';
import type { UndoItem } from '../utils/undoWindow';

const LEAVE_MS = 350;

interface Props {
  item: UndoItem;
  /** Called once the row has slid away, after its window closed or `closing` was set. */
  onGone: (id: number) => void;
  /** Close the row now (e.g. the server refused a change). */
  closing?: boolean;
  children: ReactNode;
}

/**
 * One row of an undo list: its content, a bar draining over the window
 * (green, then amber and red at the end; see the undo-* keyframes in
 * global.css) and a slide-out once the window closes.
 */
export default function UndoRow({ item, onGone, closing = false, children }: Props) {
  const { tx, deadline } = item;
  const windowMs = tx.undo_window_ms ?? 60_000;
  const [expired, setExpired] = useState(false);
  // Where the bar starts, fixed when the row appears; a later deadline gives the row a new key.
  const [startOffset] = useState(() => Math.max(0, windowMs - (deadline - Date.now())));
  const leaving = expired || closing;

  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onGone(tx.id), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onGone, tx.id]);

  return (
    <div
      className={leaving ? 'undo-leaving' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px 15px',
        maxHeight: '96px',
        overflow: 'hidden',
        ...(leaving ? { animation: `undo-leave ${LEAVE_MS}ms ease forwards`, pointerEvents: 'none' } : {}),
      }}
    >
      {children}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '16px',
          right: '16px',
          bottom: '6px',
          height: '3px',
          borderRadius: '2px',
          backgroundColor: 'var(--secondary-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            transformOrigin: 'left',
            animation: `undo-drain ${windowMs}ms linear forwards`,
            animationDelay: `-${startOffset}ms`,
          }}
        />
      </div>
    </div>
  );
}
