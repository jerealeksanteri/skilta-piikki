import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listUsers } from '../api/users';
import { createPayment } from '../api/transactions';
import type { User } from '../types';
import { BackButton, Button, Card, EmptyState, SectionHeader, Select, TextField } from '../ui';

const styles = {
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
      <EmptyState style={{ padding: '32px' }}>Admin access required.</EmptyState>
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
    <div style={{ padding: '16px' }}>
      <BackButton flush />
      <SectionHeader style={{ padding: 0, marginBottom: '12px' }}>Log cash payment</SectionHeader>
      <Card padded style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Select
          label="User"
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
        </Select>
        <TextField
          label="Amount (€)"
          type="number"
          step="0.50"
          min="0"
          placeholder="10.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Note (optional)"
          type="text"
          placeholder="Cash payment"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <div style={styles.error}>{error}</div>}
        <Button size="lg" block style={{ marginTop: '8px' }} onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Submitting...' : 'Log Payment'}
        </Button>
      </Card>
    </div>
  );
}
