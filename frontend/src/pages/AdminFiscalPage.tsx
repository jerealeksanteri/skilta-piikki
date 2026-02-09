import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import {
  listFiscalPeriods,
  closeFiscalPeriod,
  getPeriodStats,
  getPeriodDebts,
  approveDebtPayment,
  rejectDebtPayment,
  markDebtPaid,
} from '../api/fiscal';
import type { FiscalPeriod, FiscalPeriodStats, FiscalDebt } from '../types';

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
  markPaidBtn: {
    backgroundColor: 'var(--secondary-bg)',
    color: '#4caf50',
  },
  closeBtn: {
    display: 'block',
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--destructive)',
    color: '#fff',
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
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 0',
    marginBottom: '8px',
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'ongoing';
  return new Date(dateStr).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminFiscalPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<number, FiscalPeriodStats>>({});
  const [debts, setDebts] = useState<Record<number, FiscalDebt[]>>({});

  const fetchData = async () => {
    try {
      const p = await listFiscalPeriods();
      setPeriods(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
      const d = await getPeriodDebts(periodId);
      setDebts((prev) => ({ ...prev, [periodId]: d }));
      showToast('Debt payment approved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleRejectDebt = async (debtId: number, periodId: number) => {
    try {
      await rejectDebtPayment(debtId);
      const d = await getPeriodDebts(periodId);
      setDebts((prev) => ({ ...prev, [periodId]: d }));
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
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const currentPeriod = periods.find((p) => !p.ended_at);
  const closedPeriods = periods.filter((p) => p.ended_at);

  // Collect all pending debt payments across all loaded periods
  const pendingDebts: (FiscalDebt & { _periodId: number })[] = [];
  for (const [periodId, periodDebts] of Object.entries(debts)) {
    for (const d of periodDebts) {
      if (d.status === 'payment_pending') {
        pendingDebts.push({ ...d, _periodId: Number(periodId) });
      }
    }
  }

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>

      {currentPeriod && (
        <div style={styles.section}>
          <div style={styles.header}>Current period</div>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.info}>
                <div style={styles.label}>Started {formatDate(currentPeriod.started_at)}</div>
              </div>
            </div>
          </div>
          <button style={{ ...styles.closeBtn, marginTop: '12px' }} onClick={handleClose}>
            Close Period
          </button>
        </div>
      )}

      {pendingDebts.length > 0 && (
        <div style={styles.section}>
          <div style={{ ...styles.header, color: '#ff9800' }}>
            Pending debt payments ({pendingDebts.length})
          </div>
          <div style={styles.card}>
            {pendingDebts.map((debt, i) => (
              <div key={debt.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <div style={styles.info}>
                    <div style={styles.label}>{debt.user_name}</div>
                    <div style={styles.meta}>
                      {formatDate(debt.period_started_at)} — {formatDate(debt.period_ended_at)}
                    </div>
                  </div>
                  <span style={{ ...styles.amount, color: 'var(--destructive)' }}>
                    {debt.amount.toFixed(2)} €
                  </span>
                  <button
                    style={{ ...styles.actionBtn, ...styles.approveBtn }}
                    onClick={() => handleApproveDebt(debt.id, debt._periodId)}
                  >
                    ✓
                  </button>
                  <button
                    style={{ ...styles.actionBtn, ...styles.rejectBtn }}
                    onClick={() => handleRejectDebt(debt.id, debt._periodId)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.header}>Closed periods ({closedPeriods.length})</div>
        {closedPeriods.length === 0 ? (
          <div style={{ ...styles.card, ...styles.empty }}>No closed periods yet</div>
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
                    {formatDate(period.started_at)} — {formatDate(period.ended_at)}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--hint)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {isExpanded && (
                  <div>
                    <div style={styles.separator} />
                    {periodStats && (
                      <div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Purchases</span>
                          <span style={styles.statValue}>
                            {periodStats.total_purchases} ({periodStats.total_purchase_amount.toFixed(2)} €)
                          </span>
                        </div>
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
                          <span style={{ ...styles.statValue, color: '#4caf50' }}>
                            {periodStats.debt_collected.toFixed(2)} €
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={styles.statLabel}>Outstanding</span>
                          <span style={{ ...styles.statValue, color: '#ff9800' }}>
                            {periodStats.debt_outstanding.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    )}

                    {periodDebts.length > 0 && (
                      <div>
                        <div style={{ ...styles.header, padding: '8px 16px' }}>Debts</div>
                        {periodDebts.map((debt, i) => (
                          <div key={debt.id}>
                            {i > 0 && <div style={styles.separator} />}
                            <div style={styles.row}>
                              <div style={styles.info}>
                                <div style={styles.label}>{debt.user_name}</div>
                                <div style={styles.meta}>
                                  {debt.status === 'paid'
                                    ? `Paid ${formatDate(debt.paid_at)}`
                                    : debt.status === 'payment_pending'
                                      ? 'Payment pending'
                                      : 'Unpaid'}
                                </div>
                              </div>
                              <span
                                style={{
                                  ...styles.amount,
                                  color: debt.status === 'paid' ? '#4caf50' : 'var(--destructive)',
                                }}
                              >
                                {debt.amount.toFixed(2)} €
                              </span>
                              {debt.status === 'unpaid' && (
                                <button
                                  style={{ ...styles.actionBtn, ...styles.markPaidBtn }}
                                  onClick={() => handleMarkPaid(debt.id, period.id)}
                                >
                                  Mark Paid
                                </button>
                              )}
                              {debt.status === 'payment_pending' && (
                                <>
                                  <button
                                    style={{ ...styles.actionBtn, ...styles.approveBtn }}
                                    onClick={() => handleApproveDebt(debt.id, period.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    style={{ ...styles.actionBtn, ...styles.rejectBtn }}
                                    onClick={() => handleRejectDebt(debt.id, period.id)}
                                  >
                                    ✕
                                  </button>
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
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
