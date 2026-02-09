import { useState } from 'react';
import type { FiscalDebt } from '../types';
import { requestDebtPayment } from '../api/fiscal';

const styles = {
  section: {
    padding: '0 16px 16px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--destructive)',
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
  info: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--destructive)',
  },
  period: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  payBtn: {
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
  pendingBadge: {
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: '#ff9800',
    color: '#fff',
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  debts: FiscalDebt[];
  onUpdate: () => void;
}

export default function FiscalDebtsList({ debts, onUpdate }: Props) {
  const [loading, setLoading] = useState<number | null>(null);

  if (debts.length === 0) return null;

  const handlePay = async (debtId: number) => {
    if (!confirm('Mark this debt as paid? An admin will need to approve.')) return;
    setLoading(debtId);
    try {
      await requestDebtPayment(debtId);
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={styles.section}>
      <div style={styles.header}>Outstanding debts</div>
      <div style={styles.card}>
        {debts.map((debt, i) => (
          <div key={debt.id}>
            {i > 0 && <div style={styles.separator} />}
            <div style={styles.row}>
              <div style={styles.info}>
                <div style={styles.amount}>{debt.amount.toFixed(2)} €</div>
                <div style={styles.period}>
                  {formatDate(debt.period_started_at)} — {formatDate(debt.period_ended_at)}
                </div>
              </div>
              {debt.status === 'unpaid' ? (
                <button
                  style={styles.payBtn}
                  onClick={() => handlePay(debt.id)}
                  disabled={loading === debt.id}
                >
                  {loading === debt.id ? '...' : 'Pay'}
                </button>
              ) : (
                <span style={styles.pendingBadge}>Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
