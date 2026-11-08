import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  listFiscalPeriods,
  closeFiscalPeriod,
  getPeriodStats,
  getPeriodDebts,
  getPendingDebts,
  approveDebtPayment,
  rejectDebtPayment,
  markDebtPaid,
} from '../api/fiscal';
import type { FiscalPeriod, FiscalPeriodStats, FiscalDebt } from '../types';
import { formatDate } from '../utils/date';
import ExportButtons from '../components/ExportButtons';
import { BackButton, Button, Card, Divider, EmptyState, Loading, Section, SectionHeader, useToast } from '../ui';

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
  label: {
    fontSize: '14px',
    fontWeight: 500,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  amount: {
    fontSize: '14px',
    fontWeight: 600,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    padding: '8px 16px',
    fontSize: '14px',
  },
  statLabel: {
    color: 'var(--hint)',
  },
  statValue: {
    fontWeight: 600,
  },
  periodCard: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '8px',
    cursor: 'pointer',
  },
  periodHeader: {
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: '12px 16px',
  },
};

function periodDate(dateStr: string | null): string {
  return dateStr ? formatDate(dateStr) : 'ongoing';
}

export default function AdminFiscalPage() {
  const { user } = useUser();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<number, FiscalPeriodStats>>({});
  const [debts, setDebts] = useState<Record<number, FiscalDebt[]>>({});
  const [pendingDebts, setPendingDebts] = useState<FiscalDebt[]>([]);

  const fetchData = async () => {
    try {
      const [p, pd] = await Promise.all([
        listFiscalPeriods(),
        getPendingDebts(),
      ]);
      setPeriods(p);
      setPendingDebts(pd);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const handleClose = async () => {
    if (!confirm('Close the current fiscal period? All balances will be reset to 0 and debts will be created for users with negative balance.')) return;
    try {
      const result = await closeFiscalPeriod();
      showToast(`Period closed. ${result.debts_created} debts created.`);
      fetchData();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to close period');
    }
  };

  const toggleExpand = async (periodId: number) => {
    if (expandedId === periodId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(periodId);
    if (!stats[periodId]) {
      try {
        const [s, d] = await Promise.all([
          getPeriodStats(periodId),
          getPeriodDebts(periodId),
        ]);
        setStats((prev) => ({ ...prev, [periodId]: s }));
        setDebts((prev) => ({ ...prev, [periodId]: d }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleApproveDebt = async (debtId: number, periodId: number) => {
    try {
      await approveDebtPayment(debtId);
      const [d, pd] = await Promise.all([
        getPeriodDebts(periodId),
        getPendingDebts(),
      ]);
      setDebts((prev) => ({ ...prev, [periodId]: d }));
      setPendingDebts(pd);
      showToast('Debt payment approved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleRejectDebt = async (debtId: number, periodId: number) => {
    try {
      await rejectDebtPayment(debtId);
      const [d, pd] = await Promise.all([
        getPeriodDebts(periodId),
        getPendingDebts(),
      ]);
      setDebts((prev) => ({ ...prev, [periodId]: d }));
      setPendingDebts(pd);
      showToast('Debt payment rejected');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleMarkPaid = async (debtId: number, periodId: number) => {
    try {
      await markDebtPaid(debtId);
      const d = await getPeriodDebts(periodId);
      setDebts((prev) => ({ ...prev, [periodId]: d }));
      showToast('Debt marked as paid');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!user?.is_admin) {
    return <EmptyState>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
  }

  const currentPeriod = periods.find((p) => !p.ended_at);
  const closedPeriods = periods.filter((p) => p.ended_at);
  const expandedPeriod = closedPeriods.find((p) => p.id === expandedId);

  return (
    <div>
      <BackButton />

      {currentPeriod && (
        <Section title="Current period">
          <Card>
            <div style={styles.row}>
              <div style={styles.info}>
                <div style={styles.label}>Started {periodDate(currentPeriod.started_at)}</div>
              </div>
            </div>
          </Card>
          <Button size="lg" block tone="destructive" style={{ marginTop: '12px' }} onClick={handleClose}>
            Close Period
          </Button>
        </Section>
      )}

      {pendingDebts.length > 0 && (
        <Section>
          <SectionHeader tone="warning">Pending debt payments ({pendingDebts.length})</SectionHeader>
          <Card>
            {pendingDebts.map((debt, i) => (
              <div key={debt.id}>
                {i > 0 && <Divider />}
                <div style={styles.row}>
                  <div style={styles.info}>
                    <div style={styles.label}>{debt.user_name}</div>
                    <div style={styles.meta}>
                      {periodDate(debt.period_started_at)} — {periodDate(debt.period_ended_at)}
                    </div>
                  </div>
                  <span style={{ ...styles.amount, color: 'var(--destructive)' }}>
                    {debt.amount.toFixed(2)} €
                  </span>
                  <Button size="sm" tone="positive" onClick={() => handleApproveDebt(debt.id, debt.fiscal_period_id)}>
✓
</Button>
                  <Button size="sm" variant="secondary" tone="destructive" onClick={() => handleRejectDebt(debt.id, debt.fiscal_period_id)}>
✕
</Button>
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title={`Closed periods (${closedPeriods.length})`}>
        {closedPeriods.length === 0 ? (
          <Card>
            <EmptyState>No closed periods yet</EmptyState>
          </Card>
        ) : (
          closedPeriods.map((period) => {
            const isExpanded = expandedId === period.id;
            const periodStats = stats[period.id];
            const periodDebts = debts[period.id] || [];

            return (
              <div key={period.id} style={styles.periodCard}>
                <div
                  style={styles.periodHeader}
                  onClick={() => toggleExpand(period.id)}
                >
                  <span style={styles.label}>
                    {periodDate(period.started_at)} — {periodDate(period.ended_at)}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--hint)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {isExpanded && (
                  <div>
                    <Divider />
                    {periodStats && (
                      <div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Purchases</span>
                          <span style={styles.statValue}>
                            {periodStats.total_purchases} ({periodStats.total_purchase_amount.toFixed(2)} €)
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Profit</span>
                          <span style={styles.statValue}>
                            {periodStats.purchase_profit != null
                              ? `${periodStats.purchase_profit.toFixed(2)} €${
                                  periodStats.margin_pct != null ? ` (${periodStats.margin_pct} %)` : ''
                                }`
                              : 'cost missing'}
                          </span>
                        </div>
                        {!!periodStats.cost_missing_items && (
                          <div style={{ ...styles.statRow, paddingTop: 0, fontSize: '12px', color: 'var(--hint)' }}>
                            {periodStats.cost_missing_items} item{periodStats.cost_missing_items === 1 ? '' : 's'} without a
                            cost price, left out of profit
                          </div>
                        )}
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Payments</span>
                          <span style={styles.statValue}>
                            {periodStats.total_payments} ({periodStats.total_payment_amount.toFixed(2)} €)
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Total debt</span>
                          <span style={{ ...styles.statValue, color: 'var(--destructive)' }}>
                            {periodStats.total_debt.toFixed(2)} €
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Collected</span>
                          <span style={{ ...styles.statValue, color: 'var(--positive)' }}>
                            {periodStats.debt_collected.toFixed(2)} €
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Outstanding</span>
                          <span style={{ ...styles.statValue, color: 'var(--warning)' }}>
                            {periodStats.debt_outstanding.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    )}

                    {periodDebts.length > 0 && (
                      <div>
                        <SectionHeader style={{ padding: '8px 16px' }}>Debts</SectionHeader>
                        {periodDebts.map((debt, i) => (
                          <div key={debt.id}>
                            {i > 0 && <Divider />}
                            <div style={styles.row}>
                              <div style={styles.info}>
                                <div style={styles.label}>{debt.user_name}</div>
                                <div style={styles.meta}>
                                  {debt.status === 'paid'
                                    ? `Paid ${periodDate(debt.paid_at)}`
                                    : debt.status === 'payment_pending'
                                      ? 'Payment pending'
                                      : 'Unpaid'}
                                </div>
                              </div>
                              <span
                                style={{
                                  ...styles.amount,
                                  color: debt.status === 'paid' ? 'var(--positive)' : 'var(--destructive)',
                                }}
                              >
                                {debt.amount.toFixed(2)} €
                              </span>
                              {debt.status === 'unpaid' && (
                                <Button size="sm" variant="secondary" tone="positive" onClick={() => handleMarkPaid(debt.id, period.id)}>
Mark Paid
</Button>
                              )}
                              {debt.status === 'payment_pending' && (
                                <>
                                  <Button size="sm" tone="positive" onClick={() => handleApproveDebt(debt.id, period.id)}>
✓
</Button>
                                  <Button size="sm" variant="secondary" tone="destructive" onClick={() => handleRejectDebt(debt.id, period.id)}>
✕
</Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Section>

      <Section title="Export">
        <ExportButtons
          options={[
            { label: 'All periods', request: { kind: 'fiscal_periods' } },
            ...(expandedPeriod
              ? [
                  {
                    // The open period, shown above.
                    label: 'Its debts',
                    request: { kind: 'fiscal_debts' as const, period_id: expandedPeriod.id },
                  },
                ]
              : []),
          ]}
        />
        {!expandedPeriod && closedPeriods.length > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--hint)', padding: '6px 4px 0' }}>
            Open a closed period above to also export its debts.
          </div>
        )}
      </Section>
    </div>
  );
}
