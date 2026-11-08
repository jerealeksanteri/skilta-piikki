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
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px 8px',
    fontSize: '14px',
    color: 'var(--hint)',
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
  const [showGames, setShowGames] = useState(false);
  // Which navigation and filter the list was loaded for: navigating here
  // again, or flipping the toggle, shows "Loading..." until that fetch finishes.
  const requestKey = `${location.key}:${showGames}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    getMyTransactions(showGames)
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoadedKey(requestKey));
  }, [requestKey, showGames]);

  const toggle = (
    <label style={styles.toggle}>
      <input type="checkbox" checked={showGames} onChange={(e) => setShowGames(e.target.checked)} />
      Show slot machine spins
    </label>
  );

  if (loading) {
    return (
      <div>
        <div style={styles.header}>Transaction history</div>
        {toggle}
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.header}>Transaction history</div>
      {toggle}
      <TransactionList
        transactions={transactions}
        emptyText="No transactions yet. Log a drink to get started!"
      />
    </div>
  );
}
