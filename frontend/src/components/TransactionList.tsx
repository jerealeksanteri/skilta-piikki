import type { Transaction } from '../types';
import TransactionItem from './TransactionItem';

const styles = {
  empty: {
    textAlign: 'center' as const,
    padding: '32px 16px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
  list: {
    borderRadius: '12px',
    overflow: 'hidden',
    margin: '0 16px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '64px',
  },
};

interface Props {
  transactions: Transaction[];
  showUser?: boolean;
  emptyText?: string;
}

export default function TransactionList({
  transactions,
  showUser,
  emptyText = 'No transactions yet',
}: Props) {
  if (transactions.length === 0) {
    return <div style={styles.empty}>{emptyText}</div>;
  }

  return (
    <div style={styles.list}>
      {transactions.map((tx, i) => (
        <div key={tx.id}>
          {i > 0 && <div style={styles.separator} />}
          <TransactionItem transaction={tx} showUser={showUser} />
        </div>
      ))}
    </div>
  );
}
