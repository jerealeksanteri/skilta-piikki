import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { listUsers } from '../api/users';
import {
  listRewards,
  createReward,
  updateReward,
  deleteReward,
  grantReward,
  listAllGrants,
  getSchedulerStatus,
} from '../api/rewards';
import type { User, Reward, RewardGrant, SchedulerStatus } from '../types';
import { BackButton, Button, Card, DateTimeField, EmptyState, Loading, SectionHeader, Select, Tabs, TextField, useToast } from '../ui';
import { formatDateTime, formatShortDateTime, toInputValue } from '../utils/date';

const styles = {
  container: {
    padding: '16px',
  },
  section: {
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  rewardRow: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '12px',
    padding: '12px',
    borderBottom: '1px solid var(--secondary-bg)',
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: '15px',
    fontWeight: 500,
  },
  rewardMeta: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginTop: '4px',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
};

type TabType = 'one_time' | 'recurring' | 'history';

const TABS: { value: TabType; label: string }[] = [
  { value: 'one_time', label: 'One-Time Rewards' },
  { value: 'recurring', label: 'Recurring Rewards' },
  { value: 'history', label: 'Grant History' },
];

/** Headers here sit inside the page padding, so they only need space below. */
const HEADER = { padding: 0, marginBottom: '12px' };
const MULTI_SELECT = { minHeight: '120px', padding: '8px', fontSize: '14px' };
type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIOD_WORD: Record<Frequency, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};



function schedulerSummary(
  status: SchedulerStatus,
  rewards: Reward[],
): { icon: string; title: string; detail: string; warn: boolean } {
  const next = status.next_run_at ? `Next run ${formatShortDateTime(status.next_run_at)}.` : '';
  const last = status.last_run_at ? formatShortDateTime(status.last_run_at) : '';
  switch (status.state) {
    case 'never':
      return { icon: '⏳', title: "Scheduler hasn't run yet", detail: next, warn: false };
    case 'stale':
      return {
        icon: '⚠️',
        title: `Scheduler hasn't run since ${last}`,
        detail: 'It should run every hour. Check that the backend is running.',
        warn: true,
      };
    case 'failing': {
      const names = rewards
        .filter((r) => status.failed_reward_ids.includes(r.id))
        .map((r) => r.name);
      const which = names.length > 0 ? names.join(', ') : `${status.failed_reward_ids.length} reward(s)`;
      return {
        icon: '⚠️',
        title: `Last run ${last} failed for ${which}`,
        detail: `Failed rewards are retried every hour; check the backend logs. ${next}`,
        warn: true,
      };
    }
    case 'ok':
      return {
        icon: '✅',
        title: `Scheduler last ran ${last}`,
        detail: `${status.occurrences_granted} reward payout(s) in that run. ${next}`,
        warn: false,
      };
  }
}

function startHint(freq: Frequency, start: string): string {
  const period = PERIOD_WORD[freq];
  if (!start) return `Empty = first grant one ${period} from now`;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return '';
  let hint = `First grant ${formatDateTime(d)}, then every ${period}`;
  if (freq === 'monthly' && d.getDate() > 28) hint += ' (last day of shorter months)';
  if (freq === 'yearly' && d.getMonth() === 1 && d.getDate() === 29) hint += ' (Feb 28 in non-leap years)';
  return hint;
}

export default function AdminRewardsPage() {
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<TabType>('one_time');
  const [users, setUsers] = useState<User[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [grants, setGrants] = useState<RewardGrant[]>([]);
  const [schedStatus, setSchedStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  // Form state for creating one-time reward
  const [oneTimeName, setOneTimeName] = useState('');
  const [oneTimeDesc, setOneTimeDesc] = useState('');
  const [oneTimeAmount, setOneTimeAmount] = useState('');
  const [oneTimeUsers, setOneTimeUsers] = useState<number[]>([]);
  const [oneTimeNote, setOneTimeNote] = useState('');

  // Form state for creating recurring reward
  const [recurName, setRecurName] = useState('');
  const [recurDesc, setRecurDesc] = useState('');
  const [recurAmount, setRecurAmount] = useState('');
  const [recurFreq, setRecurFreq] = useState<Frequency>('monthly');
  const [recurStart, setRecurStart] = useState('');
  const [recurUsers, setRecurUsers] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch users first (always needed)
        const u = await listUsers();
        setUsers(u);

        // Try to fetch rewards and grants (may fail if migration not run)
        try {
          const r = await listRewards();
          setRewards(r);
        } catch (e) {
          console.warn('Failed to load rewards:', e);
        }

        try {
          const g = await listAllGrants(50);
          setGrants(g);
        } catch (e) {
          console.warn('Failed to load grants:', e);
        }

        try {
          setSchedStatus(await getSchedulerStatus());
        } catch (e) {
          console.warn('Failed to load scheduler status:', e);
        }
      } catch (e) {
        console.error('Failed to load users:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


  const refreshRewards = async () => {
    const r = await listRewards();
    setRewards(r);
  };

  const refreshGrants = async () => {
    const g = await listAllGrants(50);
    setGrants(g);
  };

  const handleCreateOneTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oneTimeName || !oneTimeAmount || oneTimeUsers.length === 0) {
      showToast('Please fill all required fields');
      return;
    }

    try {
      const reward = await createReward({
        name: oneTimeName,
        description: oneTimeDesc || undefined,
        amount: parseFloat(oneTimeAmount),
        reward_type: 'one_time',
        assigned_user_ids: oneTimeUsers,
      });

      // Immediately grant to selected users
      await grantReward({
        reward_id: reward.id,
        user_ids: oneTimeUsers,
        note: oneTimeNote || undefined,
      });

      showToast('One-time reward created and granted!');
      setOneTimeName('');
      setOneTimeDesc('');
      setOneTimeAmount('');
      setOneTimeUsers([]);
      setOneTimeNote('');

      refreshRewards();
      refreshGrants();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create reward');
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurName || !recurAmount) {
      showToast('Please fill all required fields');
      return;
    }

    try {
      await createReward({
        name: recurName,
        description: recurDesc || undefined,
        amount: parseFloat(recurAmount),
        reward_type: 'recurring',
        recurrence_frequency: recurFreq,
        assigned_user_ids: recurUsers,
        start_at: recurStart ? new Date(recurStart).toISOString() : undefined,
      });

      showToast('Recurring reward created!');
      setRecurName('');
      setRecurDesc('');
      setRecurAmount('');
      setRecurUsers([]);
      setRecurStart('');

      refreshRewards();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create reward');
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await deleteReward(id);
      showToast('Reward deactivated');
      refreshRewards();
    } catch {
      showToast('Failed to deactivate');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await updateReward(id, { is_active: true });
      showToast('Reward reactivated');
      refreshRewards();
    } catch {
      showToast('Failed to reactivate');
    }
  };

  if (!user?.is_admin) {
    return <EmptyState style={{ padding: '32px' }}>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
  }

  const oneTimeRewards = rewards.filter((r) => r.reward_type === 'one_time');
  const recurringRewards = rewards.filter((r) => r.reward_type === 'recurring');
  const summary = schedStatus ? schedulerSummary(schedStatus, recurringRewards) : null;

  return (
    <div style={styles.container}>
      <BackButton flush />

      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'one_time' && (
        <>
          <div style={styles.section}>
            <SectionHeader style={HEADER}>Give One-Time Reward</SectionHeader>
            <Card padded>
              <form style={styles.form} onSubmit={handleCreateOneTime}>
                <TextField
                  label="Reward Name *"
                  type="text"
                  placeholder="Holiday Bonus"
                  value={oneTimeName}
                  onChange={(e) => setOneTimeName(e.target.value)}
                />
                <TextField
                  label="Description (optional)"
                  type="text"
                  placeholder="End of year bonus"
                  value={oneTimeDesc}
                  onChange={(e) => setOneTimeDesc(e.target.value)}
                />
                <TextField
                  label="Amount (€) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="10.00"
                  value={oneTimeAmount}
                  onChange={(e) => setOneTimeAmount(e.target.value)}
                />
                <Select
                  label="Select Users * (hold Ctrl/Cmd for multiple)"
                  multiple
                  value={oneTimeUsers.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value));
                    setOneTimeUsers(selected);
                  }}
                  style={MULTI_SELECT}
                >
                  {users
                    .filter((u) => u.is_active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.username ? `(@${u.username})` : ''} — {u.balance.toFixed(2)} €
                      </option>
                    ))}
                </Select>
                <TextField
                  label="Note (optional)"
                  type="text"
                  placeholder="Special occasion"
                  value={oneTimeNote}
                  onChange={(e) => setOneTimeNote(e.target.value)}
                />
                <Button type="submit" size="lg" block style={{ marginTop: '8px' }}>
                  Give Reward to {oneTimeUsers.length} User{oneTimeUsers.length !== 1 ? 's' : ''}
                </Button>
              </form>
            </Card>
          </div>

          <div style={styles.section}>
            <SectionHeader style={HEADER}>One-Time Rewards ({oneTimeRewards.length})</SectionHeader>
            <Card padded>
              {oneTimeRewards.map((r) => (
                <div key={r.id} style={styles.rewardRow}>
                  <div style={styles.rewardInfo}>
                    <div style={styles.rewardName}>
                      {r.name}
                      {!r.is_active && (
                        <span style={{ ...styles.badge, marginLeft: '8px', opacity: 0.6 }}>Inactive</span>
                      )}
                    </div>
                    <div style={styles.rewardMeta}>
                      {r.amount.toFixed(2)} € • {r.description || 'No description'}
                    </div>
                  </div>
                  {r.is_active ? (
                    <Button size="sm" variant="secondary" onClick={() => handleDeactivate(r.id)}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => handleReactivate(r.id)}>
                      Reactivate
                    </Button>
                  )}
                </div>
              ))}
              {oneTimeRewards.length === 0 && (
                <EmptyState>
                  No one-time rewards yet
                </EmptyState>
              )}
            </Card>
          </div>
        </>
      )}

      {activeTab === 'recurring' && (
        <>
          {summary && (
            <div style={styles.section}>
              <Card
                padded
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  border: summary.warn ? '1px solid var(--destructive)' : '1px solid transparent',
                }}
              >
                <div style={{ fontSize: '20px', lineHeight: '20px' }}>{summary.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: summary.warn ? 'var(--destructive)' : 'var(--text)',
                    }}
                  >
                    {summary.title}
                  </div>
                  {summary.detail && (
                    <div style={{ fontSize: '12px', color: 'var(--hint)', marginTop: '2px' }}>
                      {summary.detail}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div style={styles.section}>
            <SectionHeader style={HEADER}>Create Recurring Reward</SectionHeader>
            <Card padded>
              <form style={styles.form} onSubmit={handleCreateRecurring}>
                <TextField
                  label="Reward Name *"
                  type="text"
                  placeholder="Weekly Allowance"
                  value={recurName}
                  onChange={(e) => setRecurName(e.target.value)}
                />
                <TextField
                  label="Description (optional)"
                  type="text"
                  placeholder="Automatic weekly credit"
                  value={recurDesc}
                  onChange={(e) => setRecurDesc(e.target.value)}
                />
                <TextField
                  label="Amount (€) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="5.00"
                  value={recurAmount}
                  onChange={(e) => setRecurAmount(e.target.value)}
                />
                <Select label="Frequency *" value={recurFreq} onChange={(e) => setRecurFreq(e.target.value as Frequency)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Select>
                <DateTimeField
                  label="First grant (optional)"
                  min={toInputValue(new Date())}
                  value={recurStart}
                  onChange={(e) => setRecurStart(e.target.value)}
                  hint={startHint(recurFreq, recurStart)}
                />
                <Select
                  label="Assign to Users (hold Ctrl/Cmd for multiple, empty = all users)"
                  multiple
                  value={recurUsers.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value));
                    setRecurUsers(selected);
                  }}
                  style={MULTI_SELECT}
                  hint={recurUsers.length === 0 ? 'Will apply to all active users' : `Selected ${recurUsers.length} user(s)`}
                >
                  {users
                    .filter((u) => u.is_active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.username ? `(@${u.username})` : ''}
                      </option>
                    ))}
                </Select>
                <Button type="submit" size="lg" block style={{ marginTop: '8px' }}>
                  Create Recurring Reward
                </Button>
              </form>
            </Card>
          </div>

          <div style={styles.section}>
            <SectionHeader style={HEADER}>Active Recurring Rewards ({recurringRewards.filter((r) => r.is_active).length})</SectionHeader>
            <Card padded>
              {recurringRewards
                .filter((r) => r.is_active)
                .map((r) => {
                  const assignedCount = r.assigned_user_ids.length;
                  const nextGrant = r.next_grant_date ? formatDateTime(r.next_grant_date) : 'N/A';

                  return (
                    <div key={r.id} style={styles.rewardRow}>
                      <div style={styles.rewardInfo}>
                        <div style={styles.rewardName}>
                          {r.name}
                          <span style={{ ...styles.badge, marginLeft: '8px' }}>{r.recurrence_frequency}</span>
                        </div>
                        <div style={styles.rewardMeta}>
                          {r.amount.toFixed(2)} € • {assignedCount === 0 ? 'All users' : `${assignedCount} user(s)`}
                        </div>
                        <div style={styles.rewardMeta}>Next grant: {nextGrant}</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => handleDeactivate(r.id)}>
                        Deactivate
                      </Button>
                    </div>
                  );
                })}
              {recurringRewards.filter((r) => r.is_active).length === 0 && (
                <EmptyState>
                  No active recurring rewards
                </EmptyState>
              )}
            </Card>
          </div>

          {recurringRewards.filter((r) => !r.is_active).length > 0 && (
            <div style={styles.section}>
              <SectionHeader style={HEADER}>Inactive Recurring Rewards</SectionHeader>
              <Card padded>
                {recurringRewards
                  .filter((r) => !r.is_active)
                  .map((r) => (
                    <div key={r.id} style={styles.rewardRow}>
                      <div style={styles.rewardInfo}>
                        <div style={styles.rewardName}>
                          {r.name}
                          <span style={{ ...styles.badge, marginLeft: '8px', opacity: 0.6 }}>Inactive</span>
                        </div>
                        <div style={styles.rewardMeta}>
                          {r.amount.toFixed(2)} € • {r.recurrence_frequency}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => handleReactivate(r.id)}>
                        Reactivate
                      </Button>
                    </div>
                  ))}
              </Card>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div style={styles.section}>
          <SectionHeader style={HEADER}>Recent Grants ({grants.length})</SectionHeader>
          <Card padded>
            {grants.map((g) => {
              const grantDate = formatDateTime(g.granted_at);
              return (
                <div key={g.id} style={styles.rewardRow}>
                  <div style={styles.rewardInfo}>
                    <div style={styles.rewardName}>
                      {g.reward_name} → {g.user_name}
                      {g.granted_by_scheduler && (
                        <span style={{ ...styles.badge, marginLeft: '8px', backgroundColor: 'var(--positive)', color: '#fff' }}>
                          Auto
                        </span>
                      )}
                    </div>
                    <div style={styles.rewardMeta}>
                      {g.amount.toFixed(2)} € • {grantDate}
                      {g.note && ` • ${g.note}`}
                    </div>
                  </div>
                </div>
              );
            })}
            {grants.length === 0 && (
              <EmptyState>No grants yet</EmptyState>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
