import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPaymentRequest } from '../api/transactions';

const styles = {
  container: {
    padding: '16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    padding: '0 0 8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '16px',
  },
  label: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginBottom: '4px',
  },
  input: {
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
    outline: 'none',
  },
  submitBtn: {
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
    marginTop: '4px',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '84px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 300,
    whiteSpace: 'nowrap' as const,
  },
};

export default function PaymentRequestPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    setSubmitting(true);
    try {
      await createPaymentRequest(parsed, note || undefined);
      setToast('Payment request sent!');
      setTimeout(() => {
        navigate('/history');
      }, 1500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = parseFloat(amount) > 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Log payment</div>
      <div style={styles.form}>
        <div>
          <div style={styles.label}>Amount (€)</div>
          <input
            style={styles.input}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <div style={styles.label}>Note (optional)</div>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Cash payment"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          style={{
            ...styles.submitBtn,
            opacity: !isValid || submitting ? 0.6 : 1,
          }}
          onClick={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? 'Sending...' : 'Request Payment'}
        </button>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
