import { useState } from 'react';
import type { FiscalDebt } from '../types';
import { requestDebtPayment } from '../api/fiscal';
import { Button, Card, Divider, Section } from '../ui';
import { formatDate as formatDay } from '../utils/date';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
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
  pendingBadge: {
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'var(--warning)',
    color: '#fff',
  },
};

function formatDate(dateStr: string | null): string {
  return dateStr ? formatDay(dateStr) : '';
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
    <Section title="Outstanding debts" titleTone="destructive">
      <Card>
        {debts.map((debt, i) => (
          <div key={debt.id}>
            {i > 0 && <Divider />}
            <div style={styles.row}>
              <div style={styles.info}>
                <div style={styles.amount}>{debt.amount.toFixed(2)} €</div>
                <div style={styles.period}>
                  {formatDate(debt.period_started_at)} — {formatDate(debt.period_ended_at)}
                </div>
              </div>
              {debt.status === 'unpaid' ? (
                <Button size="sm" onClick={() => handlePay(debt.id)} disabled={loading === debt.id}>
                  {loading === debt.id ? '...' : 'Pay'}
                </Button>
              ) : (
                <span style={styles.pendingBadge}>Pending</span>
              )}
            </div>
          </div>
        ))}
      </Card>
    </Section>
  );
}
