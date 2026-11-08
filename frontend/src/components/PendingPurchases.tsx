import { useEffect, useState } from 'react';
import { cancelPurchase, setPurchaseQuantity } from '../api/transactions';
import type { Transaction } from '../types';
import type { PendingPurchase } from '../utils/pendingPurchases';
import { Button, Card, Divider, Section, useToast } from '../ui';

const LEAVE_MS = 350;

const styles = {
  row: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center' as const,
    gap: '12px',
    padding: '12px 16px 15px',
    maxHeight: '80px',
    overflow: 'hidden',
  },
  emoji: {
    fontSize: '24px',
    width: '32px',
    textAlign: 'center' as const,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: '15px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  amount: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '6px',
  },
  stepBtn: {
    width: '34px',
    padding: '6px 0',
    fontSize: '16px',
  },
  quantity: {
    minWidth: '20px',
    textAlign: 'center' as const,
    fontSize: '15px',
    fontWeight: 600,
  },
  track: {
    position: 'absolute' as const,
    left: '16px',
    right: '16px',
    bottom: '6px',
    height: '3px',
    borderRadius: '2px',
    backgroundColor: 'var(--secondary-bg)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    transformOrigin: 'left',
  },
};

interface RowProps {
  item: PendingPurchase;
  onUpdate: (tx: Transaction) => void;
  onRemove: (id: number) => void;
}

function PendingRow({ item, onUpdate, onRemove }: RowProps) {
  const { tx, deadline } = item;
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Where the bar starts, fixed when the row appears (a later deadline gives the row a new key).
  const [startOffset] = useState(() => {
    const windowMs = tx.undo_window_ms ?? 60_000;
    return Math.max(0, windowMs - (deadline - Date.now()));
  });
  const windowMs = tx.undo_window_ms ?? 60_000;

  useEffect(() => {
    const leave = window.setTimeout(() => setLeaving(true), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(leave);
  }, [deadline]);

  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(() => onRemove(tx.id), LEAVE_MS);
    return () => window.clearTimeout(done);
  }, [leaving, onRemove, tx.id]);

  const run = async (action: () => Promise<Transaction>, cancelled: boolean) => {
    setBusy(true);
    try {
      const updated = await action();
      if (cancelled) {
        showToast(`${tx.product_emoji ?? ''} ${tx.product_name ?? 'Purchase'} undone`.trim());
        onRemove(tx.id);
      } else {
        onUpdate(updated);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not change the purchase', 3000);
      setLeaving(true);
    } finally {
      setBusy(false);
    }
  };

  const decrease = () =>
    tx.quantity <= 1
      ? run(() => cancelPurchase(tx.id), true)
      : run(() => setPurchaseQuantity(tx.id, tx.quantity - 1), false);
  const increase = () => run(() => setPurchaseQuantity(tx.id, tx.quantity + 1), false);

  return (
    <div
      className={leaving ? 'undo-leaving' : undefined}
      style={{
        ...styles.row,
        ...(leaving ? { animation: `undo-leave ${LEAVE_MS}ms ease forwards`, pointerEvents: 'none' } : {}),
      }}
    >
      <span style={styles.emoji}>{tx.product_emoji ?? '🍺'}</span>
      <div style={styles.info}>
        <div style={styles.name}>{tx.product_name ?? 'Purchase'}</div>
        <div style={styles.amount}>
          {Math.abs(tx.amount).toFixed(2)} €{tx.status === 'pending' ? ' · waiting for approval' : ''}
        </div>
      </div>
      <div style={styles.stepper}>
        <Button
          size="sm"
          variant="secondary"
          tone={tx.quantity <= 1 ? 'destructive' : 'default'}
          style={styles.stepBtn}
          disabled={busy}
          onClick={decrease}
          aria-label={tx.quantity <= 1 ? `Undo ${tx.product_name}` : `One less ${tx.product_name}`}
        >
          −
        </Button>
        <span style={styles.quantity} aria-label="Quantity">
          {tx.quantity}
        </span>
        <Button
          size="sm"
          variant="secondary"
          style={styles.stepBtn}
          disabled={busy}
          onClick={increase}
          aria-label={`One more ${tx.product_name}`}
        >
          +
        </Button>
      </div>
      <div style={styles.track} aria-hidden="true">
        <div
          style={{
            ...styles.bar,
            animation: `undo-drain ${windowMs}ms linear forwards`,
            animationDelay: `-${startOffset}ms`,
          }}
        />
      </div>
    </div>
  );
}

interface Props {
  items: PendingPurchase[];
  onUpdate: (tx: Transaction) => void;
  onRemove: (id: number) => void;
}

/** Purchases from the last minute, which the member can still change or undo. */
export default function PendingPurchases({ items, onUpdate, onRemove }: Props) {
  if (items.length === 0) return null;
  return (
    <Section title="Just logged">
      <Card>
        {items.map((item, i) => (
          <div key={`${item.tx.id}-${item.deadline}`}>
            {i > 0 && <Divider />}
            <PendingRow item={item} onUpdate={onUpdate} onRemove={onRemove} />
          </div>
        ))}
      </Card>
      <div style={{ fontSize: '12px', color: 'var(--hint)', padding: '6px 4px 0' }}>
        Tap − or + to fix it within a minute.
      </div>
    </Section>
  );
}
