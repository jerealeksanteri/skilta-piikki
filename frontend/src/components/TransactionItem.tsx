import type { Transaction } from '../types';

const statusColors: Record<string, string> = {
  approved: '#4caf50',
  pending: '#ff9800',
  rejected: 'var(--destructive)',
};

const styles = {
  item: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    backgroundColor: 'var(--bg)',
    gap: '12px',
  },
  icon: {
    fontSize: '24px',
    width: '36px',
    textAlign: 'center' as const,
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: 500,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  right: {
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  amount: {
    fontSize: '15px',
    fontWeight: 600,
  },
  status: {
    fontSize: '11px',
    fontWeight: 500,
    marginTop: '2px',
  },
};

const SLOT_EMOJI: Record<string, string> = {
  cherry: '🍒',
  lemon: '🍋',
  orange: '🍊',
  plum: '🍇',
  bell: '🔔',
  seven: '7️⃣',
};

function describe(tx: Transaction): { icon: string; title: string; metaNote: string | null } {
  switch (tx.type) {
    case 'purchase':
      return {
        icon: '🍺',
        title: `${tx.quantity > 1 ? `${tx.quantity}x ` : ''}${tx.product_name || 'Purchase'}`,
        metaNote: tx.note,
      };
    case 'reward':
      // Reward transactions carry the reward name in the note
      return { icon: '🎁', title: tx.note || 'Reward', metaNote: null };
    case 'game': {
      // The note is "Slot machine: cherry lemon plum"; older spins have no symbols.
      const reels = (tx.note ?? '').split(':')[1]?.trim().split(' ') ?? [];
      const shown = reels.map((r) => SLOT_EMOJI[r]).filter(Boolean).join(' ');
      return { icon: '🎰', title: 'Slot machine', metaNote: shown || null };
    }
    case 'adjustment':
      return { icon: '⚖️', title: 'Balance adjustment', metaNote: tx.note };
    default:
      return { icon: '💰', title: 'Payment', metaNote: tx.note };
  }
}

interface Props {
  transaction: Transaction;
  showUser?: boolean;
}

export default function TransactionItem({ transaction: tx, showUser }: Props) {
  const { icon, title, metaNote } = describe(tx);
  const date = new Date(tx.created_at).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={styles.item}>
      <div style={styles.icon}>{icon}</div>
      <div style={styles.details}>
        <div style={styles.title}>
          {title}
          {showUser && tx.user_name ? ` — ${tx.user_name}` : ''}
        </div>
        <div style={styles.meta}>
          {date}
          {metaNote ? ` · ${metaNote}` : ''}
        </div>
      </div>
      <div style={styles.right}>
        <div
          style={{
            ...styles.amount,
            color: tx.amount < 0 ? 'var(--destructive)' : '#4caf50',
          }}
        >
          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
        </div>
        <div style={{ ...styles.status, color: statusColors[tx.status] }}>
          {tx.status}
        </div>
      </div>
    </div>
  );
}
