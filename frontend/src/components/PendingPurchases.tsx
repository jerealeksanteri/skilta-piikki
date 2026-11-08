import { useState } from 'react';
import { cancelPurchase, setPurchaseQuantity } from '../api/transactions';
import type { Transaction } from '../types';
import { Button, Card, Divider, Section, useToast } from '../ui';
import type { UndoItem } from '../utils/undoWindow';
import UndoRow from './UndoRow';

const styles = {
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
};

interface RowProps {
  item: UndoItem;
  onUpdate: (tx: Transaction) => void;
  onRemove: (id: number) => void;
}

function PendingRow({ item, onUpdate, onRemove }: RowProps) {
  const { tx } = item;
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

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
      setClosing(true);
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
    <UndoRow item={item} onGone={onRemove} closing={closing}>
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
    </UndoRow>
  );
}

interface Props {
  items: UndoItem[];
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
