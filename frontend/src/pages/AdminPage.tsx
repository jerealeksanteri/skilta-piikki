import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { listUsers } from '../api/users';
import {
  getPendingTransactions,
  approveTransaction,
  rejectTransaction,
} from '../api/transactions';
import type { Transaction, User } from '../types';

const styles = {
  section: {
    padding: '0 16px 16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '16px 0 8px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
  },
  name: {
    flex: 1,
    fontSize: '15px',
    fontWeight: 500,
  },
  balance: {
    fontSize: '15px',
    fontWeight: 600,
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: '14px',
    fontWeight: 500,
  },
  txMeta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  txAmount: {
    fontSize: '14px',
    fontWeight: 600,
    marginRight: '8px',
  },
  actionBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
  },
  approveBtn: {
    backgroundColor: '#4caf50',
    color: '#fff',
  },
  rejectBtn: {
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--destructive)',
  },
  paymentBtn: {
    display: 'block',
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
    margin: '16px 0',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '20px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
    fontSize: '14px',
  },
};

export default function AdminPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [p, u] = await Promise.all([getPendingTransactions(), listUsers()]);
      setPending(p);
      setUsers(u);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!user?.is_admin) {
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const handleApprove = async (txId: number) => {
    await approveTransaction(txId);
    fetchData();
  };

  const handleReject = async (txId: number) => {
    await rejectTransaction(txId);
    fetchData();
  };

  return (
    <div>
      <div style={styles.section}>
        <button style={styles.paymentBtn} onClick={() => navigate('/admin/payment')}>
          💰 Log Cash Payment
        </button>
        <button
          style={{ ...styles.paymentBtn, marginTop: '0' }}
          onClick={() => navigate('/admin/users')}
        >
          👥 Manage Users
        </button>
        <button
          style={{ ...styles.paymentBtn, marginTop: '0' }}
          onClick={() => navigate('/admin/products')}
        >
          📦 Manage Products
        </button>
        <button
          style={{ ...styles.paymentBtn, marginTop: '0' }}
          onClick={() => navigate('/admin/fiscal')}
        >
          📊 Fiscal Periods
        </button>
        <button
          style={{ ...styles.paymentBtn, marginTop: '0' }}
          onClick={() => navigate('/admin/messages')}
        >
          💬 Message Templates
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.header}>
          Pending ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div style={{ ...styles.card, ...styles.empty }}>No pending transactions</div>
        ) : (
          <div style={styles.card}>
            {pending.map((tx, i) => (
              <div key={tx.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <div style={styles.txInfo}>
                    <div style={styles.txTitle}>
                      {tx.type === 'purchase'
                        ? tx.product_name || 'Purchase'
                        : 'Payment'}
                      {tx.user_name ? ` — ${tx.user_name}` : ''}
                    </div>
                    <div style={styles.txMeta}>
                      {tx.type === 'payment' && tx.created_by_id === tx.user_id
                        ? 'User request · '
                        : tx.type === 'payment' && tx.created_by_name
                          ? `By ${tx.created_by_name} · `
                          : ''}
                      {new Date(tx.created_at).toLocaleDateString('fi-FI', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.txAmount,
                      color: tx.amount < 0 ? 'var(--destructive)' : '#4caf50',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                  </span>
                  <button
                    style={{ ...styles.actionBtn, ...styles.approveBtn }}
                    onClick={() => handleApprove(tx.id)}
                  >
                    ✓
                  </button>
                  <button
                    style={{ ...styles.actionBtn, ...styles.rejectBtn }}
                    onClick={() => handleReject(tx.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.header}>All users</div>
        <div style={styles.card}>
          {users.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <div style={styles.separator} />}
              <div style={styles.row}>
                <span style={styles.name}>
                  {u.first_name}
                  {u.username ? ` (@${u.username})` : ''}
                  {u.is_admin ? ' ⚙️' : ''}
                </span>
                <span
                  style={{
                    ...styles.balance,
                    color: u.balance < 0 ? 'var(--destructive)' : '#4caf50',
                  }}
                >
                  {u.balance.toFixed(2)} €
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
