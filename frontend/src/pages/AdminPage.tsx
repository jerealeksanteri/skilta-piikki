import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listUsers } from '../api/users';
import {
  getPendingTransactions,
  approveTransaction,
  rejectTransaction,
} from '../api/transactions';
import type { Transaction, User } from '../types';
import LedgerStatus from '../components/LedgerStatus';
import { formatDayTime } from '../utils/date';
import { Button, Card, Divider, EmptyState, Loading, Section } from '../ui';

const styles = {
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '16px 0 8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
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
};

const ADMIN_LINKS = [
  { to: '/admin/payment', label: '💰 Log Cash Payment' },
  { to: '/admin/users', label: '👥 Manage Users' },
  { to: '/admin/products', label: '📦 Manage Products' },
  { to: '/admin/fiscal', label: '📊 Fiscal Periods' },
  { to: '/admin/reports', label: '📈 Purchase Reports' },
  { to: '/admin/newsletter', label: '📣 Send Newsletter' },
  { to: '/admin/messages', label: '💬 Message Templates' },
  { to: '/admin/rewards', label: '🎁 Manage Rewards' },
  { to: '/admin/slot-machine', label: '🎰 Slot Machine' },
  { to: '/admin/audit-log', label: '🧾 Audit Log' },
];

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
    return <EmptyState>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
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
      <Section>
        {ADMIN_LINKS.map((link, i) => (
          <Button
            key={link.to}
            size="lg"
            block
            style={{ margin: i === 0 ? '16px 0' : '0 0 16px' }}
            onClick={() => navigate(link.to)}
          >
            {link.label}
          </Button>
        ))}
      </Section>

      <Section>
        <LedgerStatus />
      </Section>

      <Section>
        <div style={styles.header}>
          Pending ({pending.length})
        </div>
        {pending.length === 0 ? (
          <Card>
            <EmptyState>No pending transactions</EmptyState>
          </Card>
        ) : (
          <Card>
            {pending.map((tx, i) => (
              <div key={tx.id}>
                {i > 0 && <Divider />}
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
                      {formatDayTime(tx.created_at)}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.txAmount,
                      color: tx.amount < 0 ? 'var(--destructive)' : 'var(--positive)',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                  </span>
                  <Button size="sm" tone="positive" onClick={() => handleApprove(tx.id)}>
                    ✓
                  </Button>
                  <Button size="sm" variant="secondary" tone="destructive" onClick={() => handleReject(tx.id)}>
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section title="All users">
        <Card>
          {users.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <Divider />}
              <div style={styles.row}>
                <span style={styles.name}>
                  {u.first_name}
                  {u.username ? ` (@${u.username})` : ''}
                  {u.is_admin ? ' ⚙️' : ''}
                </span>
                <span
                  style={{
                    ...styles.balance,
                    color: u.balance < 0 ? 'var(--destructive)' : 'var(--positive)',
                  }}
                >
                  {u.balance.toFixed(2)} €
                </span>
              </div>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}
