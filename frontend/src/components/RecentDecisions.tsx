import { useState } from 'react';
import { undoDecision } from '../api/transactions';
import type { Transaction } from '../types';
import { Button, Card, Divider, Section, useToast } from '../ui';
import type { UndoItem } from '../utils/undoWindow';
import UndoRow from './UndoRow';

function title(tx: Transaction): string {
  const what = tx.type === 'purchase' ? tx.product_name || 'Purchase' : 'Payment';
  return tx.user_name ? `${what} — ${tx.user_name}` : what;
}

interface RowProps {
  item: UndoItem;
  onUndone: (tx: Transaction) => void;
  onGone: (id: number) => void;
}

function DecisionRow({ item, onUndone, onGone }: RowProps) {
  const { tx } = item;
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const approved = tx.status === 'approved';

  const undo = async () => {
    setBusy(true);
    try {
      onUndone(await undoDecision(tx.id));
      showToast(`${title(tx)} is back in Pending`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not undo', 3000);
      setClosing(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UndoRow item={item} onGone={onGone} closing={closing}>
      <span
        style={{ fontSize: '18px', width: '24px', textAlign: 'center', color: approved ? 'var(--positive)' : 'var(--destructive)' }}
        aria-label={approved ? 'Approved' : 'Rejected'}
      >
        {approved ? '✓' : '✕'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>{title(tx)}</div>
        <div style={{ fontSize: '12px', color: 'var(--hint)', marginTop: '2px' }}>
          {approved ? 'Approved' : 'Rejected'}
          {tx.approved_by_name ? ` by ${tx.approved_by_name}` : ''} · {tx.amount > 0 ? '+' : ''}
          {tx.amount.toFixed(2)} €
        </div>
      </div>
      <Button size="sm" variant="secondary" disabled={busy} onClick={undo}>
        Undo
      </Button>
    </UndoRow>
  );
}

interface Props {
  items: UndoItem[];
  onUndone: (tx: Transaction) => void;
  onGone: (id: number) => void;
}

/** Approvals and rejections from the last minute, which any admin can still undo. */
export default function RecentDecisions({ items, onUndone, onGone }: Props) {
  if (items.length === 0) return null;
  return (
    <Section title="Just decided">
      <Card>
        {items.map((item, i) => (
          <div key={`${item.tx.id}-${item.deadline}`}>
            {i > 0 && <Divider />}
            <DecisionRow item={item} onUndone={onUndone} onGone={onGone} />
          </div>
        ))}
      </Card>
      <div style={{ fontSize: '12px', color: 'var(--hint)', padding: '6px 4px 0' }}>
        Members are told when the minute is up.
      </div>
    </Section>
  );
}
