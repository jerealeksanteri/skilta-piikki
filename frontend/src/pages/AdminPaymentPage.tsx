import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { listUsers } from '../api/users';
import { createPayment } from '../api/transactions';
import type { User } from '../types';

const styles = {
  container: {
    padding: '16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  label: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginBottom: '6px',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
    marginTop: '8px',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 0',
    marginBottom: '8px',
  },
  error: {
    color: 'var(--destructive)',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
};

export default function AdminPaymentPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers().then(setUsers).catch(console.error);
  }, []);

  if (!user?.is_admin) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--hint)' }}>
        Admin access required.
      </div>
    );
  }

  const canSubmit = selectedUserId !== '' && parseFloat(amount) > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPayment(selectedUserId as number, parseFloat(amount), note || undefined);
      navigate('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>
      <div style={styles.header}>Log cash payment</div>
      <div style={styles.card}>
        <div>
          <div style={styles.label}>User</div>
          <select
            style={styles.select}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select user...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name}
                {u.username ? ` (@${u.username})` : ''}
                {' '}— {u.balance.toFixed(2)} €
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={styles.label}>Amount (€)</div>
          <input
            style={styles.input}
            type="number"
            step="0.50"
            min="0"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <div style={styles.label}>Note (optional)</div>
          <input
            style={styles.input}
            type="text"
            placeholder="Cash payment"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <button
          style={{
            ...styles.submitBtn,
            ...(canSubmit ? {} : styles.disabledBtn),
          }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? 'Submitting...' : 'Log Payment'}
        </button>
      </div>
    </div>
  );
}
