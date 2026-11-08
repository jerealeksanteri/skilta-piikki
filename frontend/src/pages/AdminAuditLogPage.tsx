import { useEffect, useState } from 'react';
import { getAuditFilters, getAuditLog } from '../api/audit';
import type { AuditQuery } from '../api/audit';
import { useUser } from '../context/UserContext';
import type { AuditEntry, AuditFilters } from '../types';
import { BackButton, Card, EmptyState, Section, SectionHeader } from '../ui';
import { formatDateTime } from '../utils/date';

const LIST_MESSAGE = { padding: '24px' };

const styles = {
  filters: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  select: {
    flex: '1 1 160px',
    minWidth: 0,
    padding: '10px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
  },
  entry: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--secondary-bg)',
  },
  title: {
    fontSize: '15px',
    fontWeight: 500,
  },
  target: {
    color: 'var(--hint)',
    fontWeight: 400,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  changes: {
    fontSize: '13px',
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  from: {
    color: 'var(--hint)',
    textDecoration: 'line-through',
  },
  note: {
    fontSize: '13px',
    marginTop: '6px',
  },
  moreBtn: {
    width: '100%',
    padding: '12px',
    marginTop: '12px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg)',
    color: 'var(--link)',
    fontSize: '14px',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  user: 'Members',
  payment: 'Payments',
  transaction: 'Transactions',
  product: 'Products',
  reward: 'Rewards',
  fiscal_period: 'Fiscal periods',
  fiscal_debt: 'Debts',
  message_template: 'Message templates',
  newsletter: 'Newsletters',
  slot_machine: 'Slot machine',
};

const ACTION_LABELS: Record<string, string> = {
  'user.create': 'Added member',
  'user.bulk_create': 'Added members',
  'user.reset_all': 'Reset all members',
  'user.activate': 'Approved member',
  'user.deactivate': 'Deactivated member',
  'user.promote': 'Made admin',
  'user.demote': 'Removed admin rights',
  'user.deny': 'Denied registration',
  'payment.create': 'Logged payment',
  'transaction.approve': 'Approved',
  'transaction.reject': 'Rejected',
  'transaction.undo_decision': 'Undid approve/reject',
  'product.create': 'Added product',
  'product.update': 'Edited product',
  'product.deactivate': 'Removed product',
  'reward.create': 'Created reward',
  'reward.update': 'Edited reward',
  'reward.deactivate': 'Deactivated reward',
  'reward.grant': 'Granted reward',
  'fiscal_period.close': 'Closed fiscal period',
  'fiscal_debt.approve_payment': 'Approved debt payment',
  'fiscal_debt.reject_payment': 'Rejected debt payment',
  'fiscal_debt.mark_paid': 'Marked debt paid',
  'message_template.update': 'Edited message template',
  'newsletter.send': 'Sent newsletter',
  'slot_machine.toggle': 'Switched slot machine',
};

const FIELD_LABELS: Record<string, string> = {
  is_active: 'Active',
  is_admin: 'Admin',
  sort_order: 'Order',
  telegram_id: 'Telegram ID',
  first_name: 'First name',
  last_name: 'Last name',
  recurrence_frequency: 'Frequency',
  assigned_user_ids: 'Assigned to',
  next_grant_date: 'Next grant',
  reward_type: 'Type',
};

const MONEY_FIELDS = new Set(['price', 'amount']);

function actionLabel(entry: AuditEntry): string {
  if (entry.action === 'slot_machine.toggle') {
    return entry.changes?.enabled?.to ? 'Turned the slot machine on' : 'Turned the slot machine off';
  }
  return ACTION_LABELS[entry.action] ?? entry.action;
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (MONEY_FIELDS.has(field)) return `${String(value).replace('.', ',')} €`;
  if (field === 'next_grant_date' && typeof value === 'string') return formatDateTime(`${value}Z`);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}


function EntryRow({ entry }: { entry: AuditEntry }) {
  const changes = Object.entries(entry.changes ?? {});
  const created = changes.length > 0 && changes.every(([, c]) => c.from === null);
  return (
    <div style={styles.entry}>
      <div style={styles.title}>
        {actionLabel(entry)}
        {entry.target_label && entry.action !== 'slot_machine.toggle' && (
          <span style={styles.target}> · {entry.target_label}</span>
        )}
      </div>
      <div style={styles.meta}>
        {entry.actor_name} · {formatDateTime(entry.created_at)}
      </div>
      {changes.length > 0 && (
        <div style={styles.changes}>
          {changes.map(([field, c]) => (
            <div key={field}>
              {fieldLabel(field)}:{' '}
              {!created && (
                <>
                  <span style={styles.from}>{formatValue(field, c.from)}</span> →{' '}
                </>
              )}
              {formatValue(field, c.to)}
            </div>
          ))}
        </div>
      )}
      {entry.note && <div style={styles.note}>{entry.note}</div>}
    </div>
  );
}

export default function AdminAuditLogPage() {
  const { user } = useUser();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>({ actors: [], actions: [] });
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAuditLog(), getAuditFilters()])
      .then(([page, f]) => {
        setEntries(page.entries);
        setHasMore(page.has_more);
        setFilters(f);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the audit log'))
      .finally(() => setLoading(false));
  }, []);

  const load = async (query: AuditQuery, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const page = await getAuditLog(query);
      setEntries((prev) => (append ? [...prev, ...page.entries] : page.entries));
      setHasMore(page.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the audit log');
    } finally {
      setLoading(false);
    }
  };

  const query = (nextActor: string, nextAction: string): AuditQuery => ({
    actorId: nextActor ? Number(nextActor) : undefined,
    action: nextAction || undefined,
  });

  const changeActor = (value: string) => {
    setActorId(value);
    load(query(value, action), false);
  };

  const changeAction = (value: string) => {
    setAction(value);
    load(query(actorId, value), false);
  };

  const loadMore = () => {
    const last = entries.at(-1);
    if (last) load({ ...query(actorId, action), beforeId: last.id }, true);
  };

  if (!user?.is_admin) {
    return <EmptyState>Admin access required.</EmptyState>;
  }

  // Group the known actions under their category for the filter menu.
  const categories = [...new Set(filters.actions.map((a) => a.split('.')[0]))];

  return (
    <div>
      <BackButton />

      <Section>
        <div style={styles.filters}>
          <select
            style={styles.select}
            value={actorId}
            onChange={(e) => changeActor(e.target.value)}
            aria-label="Filter by admin"
          >
            <option value="">All admins</option>
            {filters.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            style={styles.select}
            value={action}
            onChange={(e) => changeAction(e.target.value)}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                <option value={cat}>All {(CATEGORY_LABELS[cat] ?? cat).toLowerCase()}</option>
                {filters.actions
                  .filter((a) => a.startsWith(`${cat}.`))
                  .map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABELS[a] ?? a}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <SectionHeader>Audit log</SectionHeader>
        <Card>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
          {!loading && !error && entries.length === 0 && (
            <EmptyState style={LIST_MESSAGE}>No admin actions recorded yet.</EmptyState>
          )}
          {loading && entries.length === 0 && <EmptyState style={LIST_MESSAGE}>Loading...</EmptyState>}
          {error && <EmptyState style={{ ...LIST_MESSAGE, color: 'var(--destructive)' }}>{error}</EmptyState>}
        </Card>

        {hasMore && (
          <button style={styles.moreBtn} onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </Section>
    </div>
  );
}
