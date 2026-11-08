import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPaymentRequest } from '../api/transactions';
import { Button, Card, SectionHeader, TextField, useToast } from '../ui';

export default function PaymentRequestPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setSubmitting(true);
    try {
      await createPaymentRequest(parsed, note || undefined);
      showToast('Payment request sent!');
      setTimeout(() => {
        navigate('/history');
      }, 1500);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = parseFloat(amount) > 0;

  return (
    <div style={{ padding: '16px' }}>
      <SectionHeader style={{ padding: '0 0 8px' }}>Log payment</SectionHeader>
      <Card padded style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <TextField
          label="Amount (€)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Note (optional)"
          type="text"
          placeholder="e.g. Cash payment"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button size="lg" style={{ marginTop: '4px' }} onClick={handleSubmit} disabled={!isValid || submitting}>
          {submitting ? 'Sending...' : 'Request Payment'}
        </Button>
      </Card>
    </div>
  );
}
