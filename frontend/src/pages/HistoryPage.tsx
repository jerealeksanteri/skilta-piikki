import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyTransactions } from '../api/transactions';
import type { Transaction } from '../types';
import TransactionList from '../components/TransactionList';

const styles = {
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '16px 16px 8px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
};

export default function HistoryPage() {
  const location = useLocation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMyTransactions()
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [location.key]);

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      <div style={styles.header}>Transaction history</div>
      <TransactionList
        transactions={transactions}
        emptyText="No transactions yet. Log a drink to get started!"
      />
    </div>
  );
}
