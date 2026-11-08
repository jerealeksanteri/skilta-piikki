import type { Transaction } from '../types';
import TransactionItem from './TransactionItem';
import { Divider, EmptyState } from '../ui';

const styles = {
  list: {
    borderRadius: '12px',
    overflow: 'hidden',
    margin: '0 16px',
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
    return <EmptyState style={{ padding: '32px 16px' }}>{emptyText}</EmptyState>;
  }

  return (
    <div style={styles.list}>
      {transactions.map((tx, i) => (
        <div key={tx.id}>
          {/* Indented past the icon column. */}
          {i > 0 && <Divider inset={64} />}
          <TransactionItem transaction={tx} showUser={showUser} />
        </div>
      ))}
    </div>
  );
}
