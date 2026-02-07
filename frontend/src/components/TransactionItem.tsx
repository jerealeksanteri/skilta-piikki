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

interface Props {
  transaction: Transaction;
  showUser?: boolean;
}

export default function TransactionItem({ transaction: tx, showUser }: Props) {
  const isPurchase = tx.type === 'purchase';
  const date = new Date(tx.created_at).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={styles.item}>
      <div style={styles.icon}>{isPurchase ? '🍺' : '💰'}</div>
      <div style={styles.details}>
        <div style={styles.title}>
          {isPurchase ? tx.product_name || 'Purchase' : 'Payment'}
          {showUser && tx.user_name ? ` — ${tx.user_name}` : ''}
        </div>
        <div style={styles.meta}>
          {date}
          {tx.note ? ` · ${tx.note}` : ''}
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
