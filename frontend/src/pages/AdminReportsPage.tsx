import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getPurchaseReport } from '../api/reports';
import TransactionItem from '../components/TransactionItem';
import type { PurchaseReport, ReportProductSummary, TransactionStatus } from '../types';
import { BackButton, Card, Chip, DateTimeField, Divider, EmptyState, Section } from '../ui';
import { fromInputValue, toInputValue } from '../utils/date';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
  },
  subRow: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '6px 16px 6px 40px',
    gap: '12px',
    fontSize: '13px',
    color: 'var(--hint)',
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: '15px',
    fontWeight: 500,
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  valueMeta: {
    fontSize: '12px',
    color: 'var(--hint)',
    fontWeight: 400,
  },
  windowCard: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  dateRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  dateField: {
    flex: '1 1 240px',
    minWidth: 0,
  },
  dateLabel: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginBottom: '4px',
  },
  dateInput: {
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginTop: '10px',
  },
  totals: {
    display: 'flex',
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '16px 8px',
  },
  totalCell: {
    flex: 1,
    textAlign: 'center' as const,
  },
  totalValue: {
    fontSize: '22px',
    fontWeight: 700,
  },
  totalLabel: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  chevron: {
    width: '12px',
    color: 'var(--hint)',
    fontSize: '12px',
  },
  note: {
    fontSize: '12px',
    color: 'var(--hint)',
    padding: '8px 4px 0',
  },
};

const STATUSES: TransactionStatus[] = ['approved', 'pending', 'rejected'];

type PresetKey = 'today' | 'sinceYesterdayEvening' | 'last24h' | 'thisWeek' | 'thisMonth';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'sinceYesterdayEvening', label: 'Since yesterday 18:00' },
  { key: 'last24h', label: 'Last 24 h' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'thisMonth', label: 'This month' },
];

/** End of the current minute, so purchases made "now" are inside the window. */
function nextMinute(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

function presetWindow(key: PresetKey): { start: Date; end: Date } {
  const end = nextMinute();
  const start = new Date();
  start.setSeconds(0, 0);
  switch (key) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'sinceYesterdayEvening':
      start.setDate(start.getDate() - 1);
      start.setHours(18, 0, 0, 0);
      break;
    case 'last24h':
      start.setTime(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'thisWeek': {
      const daysSinceMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysSinceMonday);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'thisMonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}



/** "profit 4.50 € · 60 %", or "cost missing" when no purchase had a cost price. */
function profitText(p: ReportProductSummary): string {
  if (p.profit == null) return 'cost missing';
  const parts = [`profit ${euros(p.profit)}`];
  if (p.margin_pct != null) parts.push(`${p.margin_pct} %`);
  if (p.cost_missing_items) parts.push(`${p.cost_missing_items} without cost`);
  return parts.join(' · ');
}

function euros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function productLabel(p: ReportProductSummary): string {
  return `${p.emoji ?? '🛒'} ${p.product_name ?? 'Unknown product'}`;
}

export default function AdminReportsPage() {
  const { user } = useUser();
  const initial = presetWindow('sinceYesterdayEvening');
  const [startValue, setStartValue] = useState(toInputValue(initial.start));
  const [endValue, setEndValue] = useState(toInputValue(initial.end));
  const [activePreset, setActivePreset] = useState<PresetKey | null>('sinceYesterdayEvening');
  const [statuses, setStatuses] = useState<TransactionStatus[]>(['approved', 'pending']);
  const [report, setReport] = useState<PurchaseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const requestId = useRef(0);

  const start = fromInputValue(startValue);
  const end = fromInputValue(endValue);
  const validationError =
    !start || !end
      ? 'Pick both a start and an end time.'
      : start >= end
        ? 'Start must be before end.'
        : statuses.length === 0
          ? 'Select at least one status.'
          : null;

  useEffect(() => {
    if (!user?.is_admin || validationError || !start || !end) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    getPurchaseReport(start, end, statuses)
      .then((data) => {
        if (id === requestId.current) setReport(data);
      })
      .catch((e: Error) => {
        if (id === requestId.current) setError(e.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // start/end are derived from the input strings below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_admin, startValue, endValue, statuses, validationError]);

  if (!user?.is_admin) {
    return <EmptyState>Admin access required.</EmptyState>;
  }

  const applyPreset = (key: PresetKey) => {
    const w = presetWindow(key);
    setStartValue(toInputValue(w.start));
    setEndValue(toInputValue(w.end));
    setActivePreset(key);
  };

  const toggleStatus = (s: TransactionStatus) => {
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : STATUSES.filter((x) => x === s || prev.includes(x)),
    );
  };

  const toggleUser = (userId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div>
      <BackButton />
      <Section>
        <div style={styles.windowCard}>
          <div style={styles.dateRow}>
            <label style={styles.dateField}>
              <div style={styles.dateLabel}>From</div>
              <DateTimeField
                size="sm"
                style={styles.dateInput}
                value={startValue}
                onChange={(e) => {
                  setStartValue(e.target.value);
                  setActivePreset(null);
                }}
              />
            </label>
            <label style={styles.dateField}>
              <div style={styles.dateLabel}>To</div>
              <DateTimeField
                size="sm"
                style={styles.dateInput}
                value={endValue}
                onChange={(e) => {
                  setEndValue(e.target.value);
                  setActivePreset(null);
                }}
              />
            </label>
          </div>
          <div style={styles.chips}>
            {PRESETS.map((p) => (
              <Chip key={p.key} selected={activePreset === p.key} onClick={() => applyPreset(p.key)}>
                {p.label}
              </Chip>
            ))}
          </div>
          <div style={styles.chips}>
            {STATUSES.map((s) => (
              <Chip key={s} selected={statuses.includes(s)} onClick={() => toggleStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      </Section>

      {validationError ? (
        <Section>
          <Card>
            <EmptyState>{validationError}</EmptyState>
          </Card>
        </Section>
      ) : error ? (
        <Section>
          <Card>
            <EmptyState style={{ color: 'var(--destructive)' }}>{error}</EmptyState>
          </Card>
        </Section>
      ) : !report ? (
        <EmptyState>Loading...</EmptyState>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <Section>
            <div style={styles.totals}>
              <div style={styles.totalCell}>
                <div style={styles.totalValue}>{report.total_items}</div>
                <div style={styles.totalLabel}>items</div>
              </div>
              <div style={styles.totalCell}>
                <div style={styles.totalValue}>{euros(report.total_amount)}</div>
                <div style={styles.totalLabel}>total</div>
              </div>
              <div style={styles.totalCell}>
                <div style={styles.totalValue}>{report.user_count}</div>
                <div style={styles.totalLabel}>people</div>
              </div>
            </div>
          </Section>

          <Section title="Profit">
            <Card>
              <div style={styles.row}>
                <div style={styles.label}>Profit</div>
                <div style={styles.value}>
                  {report.total_profit != null ? euros(report.total_profit) : 'cost missing'}
                  {report.margin_pct != null && <span style={styles.valueMeta}> · {report.margin_pct} % margin</span>}
                </div>
              </div>
            </Card>
            {!!report.cost_missing_items && (
              <div style={styles.note}>
                {report.cost_missing_items} item{report.cost_missing_items === 1 ? '' : 's'} without a cost price, left
                out of profit. Set cost prices in Admin → Products.
              </div>
            )}
          </Section>

          <Section title="By product">
            {report.by_product.length === 0 ? (
              <Card>
                <EmptyState>No purchases in this window</EmptyState>
              </Card>
            ) : (
              <Card>
                {report.by_product.map((p, i) => (
                  <div key={p.product_id ?? `none-${i}`}>
                    {i > 0 && <Divider />}
                    <div style={styles.row}>
                      <div style={styles.label}>
                        {productLabel(p)}
                        <div style={styles.valueMeta}>{profitText(p)}</div>
                      </div>
                      <div style={styles.value}>
                        {p.items} <span style={styles.valueMeta}>· {euros(p.amount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </Section>

          {report.by_user.length > 0 && (
            <Section title="By user">
              <Card>
                {report.by_user.map((u, i) => {
                  const open = expanded.has(u.user_id);
                  return (
                    <div key={u.user_id}>
                      {i > 0 && <Divider />}
                      <div
                        style={{ ...styles.row, cursor: 'pointer' }}
                        onClick={() => toggleUser(u.user_id)}
                      >
                        <span style={styles.chevron}>{open ? '▾' : '▸'}</span>
                        <div style={styles.label}>{u.user_name ?? `User #${u.user_id}`}</div>
                        <div style={styles.value}>
                          {u.items} <span style={styles.valueMeta}>· {euros(u.amount)}</span>
                        </div>
                      </div>
                      {open &&
                        u.products.map((p, j) => (
                          <div key={p.product_id ?? `none-${j}`} style={styles.subRow}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {productLabel(p)} ×{p.items}
                            </div>
                            <div>{euros(p.amount)}</div>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </Card>
            </Section>
          )}

          {report.transactions.length > 0 && (
            <Section title={`Transactions (${report.transaction_count})`}>
              <Card>
                {report.transactions.map((tx, i) => (
                  <div key={tx.id}>
                    {i > 0 && <Divider />}
                    <TransactionItem transaction={tx} showUser />
                  </div>
                ))}
              </Card>
              {report.transactions_truncated && (
                <div style={styles.note}>
                  Showing the newest {report.transactions.length} of {report.transaction_count}.
                  Totals above include all of them.
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
