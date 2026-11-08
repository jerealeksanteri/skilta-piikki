import type { Transaction } from '../types';

/** A purchase still inside its undo window, with when that window ends on this device's clock. */
export interface PendingPurchase {
  tx: Transaction;
  /** Date.now() value when the window closes, from the server's remaining time. */
  deadline: number;
}

/** Turn server responses into rows, keeping each row's deadline steady across small re-syncs. */
export function toPending(txs: Transaction[], now: number, previous: PendingPurchase[] = []): PendingPurchase[] {
  return txs
    .filter((tx) => tx.undo_remaining_ms)
    .map((tx) => {
      const deadline = now + (tx.undo_remaining_ms ?? 0);
      const old = previous.find((p) => p.tx.id === tx.id);
      // A re-sync lands a few ms off; keep the old deadline so the bar doesn't restart.
      return { tx, deadline: old && Math.abs(old.deadline - deadline) < 1500 ? old.deadline : deadline };
    });
}
