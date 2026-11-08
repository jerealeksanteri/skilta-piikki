import type { Transaction } from '../types';

/** A transaction whose undo window is still open, with when it closes on this device's clock. */
export interface UndoItem {
  tx: Transaction;
  /** Date.now() value when the window closes, from the server's remaining time. */
  deadline: number;
}

type RemainingField = 'undo_remaining_ms' | 'decision_remaining_ms';

/**
 * Turn server responses into rows. The server sends time left rather than a
 * deadline, so a phone with a wrong clock still counts right. A re-sync lands
 * a few ms off; rows keep their old deadline then, so their bar doesn't restart.
 */
export function toUndoItems(
  txs: Transaction[],
  now: number,
  previous: UndoItem[] = [],
  field: RemainingField = 'undo_remaining_ms',
): UndoItem[] {
  return txs
    .filter((tx) => tx[field])
    .map((tx) => {
      const deadline = now + (tx[field] ?? 0);
      const old = previous.find((p) => p.tx.id === tx.id);
      return { tx, deadline: old && Math.abs(old.deadline - deadline) < 1500 ? old.deadline : deadline };
    });
}
