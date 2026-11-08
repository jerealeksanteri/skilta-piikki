import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const styles = {
  container: {
    padding: '16px',
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 0',
    marginBottom: '8px',
  },
  section: {
    marginBottom: '24px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--section-header)',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid var(--secondary-bg)',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--hint)',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
  },
  activeTab: {
    color: 'var(--text)',
    borderBottomColor: 'var(--btn)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
    appearance: 'none' as const,
  },
  multiSelect: {
    width: '100%',
    minHeight: '120px',
    padding: '8px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '14px',
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
    marginTop: '8px',
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
  actionBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '104px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 300,
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
  empty: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
  },
};

type TabType = 'one_time' | 'recurring' | 'history';
type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIOD_WORD: Record<Frequency, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

/** Format a Date as the local-time value a datetime-local input expects. */
function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function schedulerSummary(
  status: SchedulerStatus,
  rewards: Reward[],
): { icon: string; title: string; detail: string; warn: boolean } {
  const next = status.next_run_at ? `Next run ${formatShort(status.next_run_at)}.` : '';
  const last = status.last_run_at ? formatShort(status.last_run_at) : '';
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
  let hint = `First grant ${d.toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}, then every ${period}`;
  if (freq === 'monthly' && d.getDate() > 28) hint += ' (last day of shorter months)';
  if (freq === 'yearly' && d.getMonth() === 1 && d.getDate() === 29) hint += ' (Feb 28 in non-leap years)';
  return hint;
}

export default function AdminRewardsPage() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('one_time');
  const [users, setUsers] = useState<User[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [grants, setGrants] = useState<RewardGrant[]>([]);
  const [schedStatus, setSchedStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const oneTimeRewards = rewards.filter((r) => r.reward_type === 'one_time');
  const recurringRewards = rewards.filter((r) => r.reward_type === 'recurring');
  const summary = schedStatus ? schedulerSummary(schedStatus, recurringRewards) : null;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'one_time' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('one_time')}
        >
          One-Time Rewards
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'recurring' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('recurring')}
        >
          Recurring Rewards
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'history' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('history')}
        >
          Grant History
        </button>
      </div>

      {activeTab === 'one_time' && (
        <>
          <div style={styles.section}>
            <div style={styles.header}>Give One-Time Reward</div>
            <div style={styles.card}>
              <form style={styles.form} onSubmit={handleCreateOneTime}>
                <div>
                  <div style={styles.label}>Reward Name *</div>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Holiday Bonus"
                    value={oneTimeName}
                    onChange={(e) => setOneTimeName(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Description (optional)</div>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="End of year bonus"
                    value={oneTimeDesc}
                    onChange={(e) => setOneTimeDesc(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Amount (€) *</div>
                  <input
                    style={styles.input}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="10.00"
                    value={oneTimeAmount}
                    onChange={(e) => setOneTimeAmount(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Select Users * (hold Ctrl/Cmd for multiple)</div>
                  <select
                    style={styles.multiSelect}
                    multiple
                    value={oneTimeUsers.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value));
                      setOneTimeUsers(selected);
                    }}
                  >
                    {users
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.username ? `(@${u.username})` : ''} — {u.balance.toFixed(2)} €
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <div style={styles.label}>Note (optional)</div>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Special occasion"
                    value={oneTimeNote}
                    onChange={(e) => setOneTimeNote(e.target.value)}
                  />
                </div>
                <button type="submit" style={styles.submitBtn}>
                  Give Reward to {oneTimeUsers.length} User{oneTimeUsers.length !== 1 ? 's' : ''}
                </button>
              </form>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.header}>One-Time Rewards ({oneTimeRewards.length})</div>
            <div style={styles.card}>
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
                    <button style={styles.actionBtn} onClick={() => handleDeactivate(r.id)}>
                      Deactivate
                    </button>
                  ) : (
                    <button style={styles.actionBtn} onClick={() => handleReactivate(r.id)}>
                      Reactivate
                    </button>
                  )}
                </div>
              ))}
              {oneTimeRewards.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hint)' }}>
                  No one-time rewards yet
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'recurring' && (
        <>
          {summary && (
            <div style={styles.section}>
              <div
                style={{
                  ...styles.card,
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
              </div>
            </div>
          )}

          <div style={styles.section}>
            <div style={styles.header}>Create Recurring Reward</div>
            <div style={styles.card}>
              <form style={styles.form} onSubmit={handleCreateRecurring}>
                <div>
                  <div style={styles.label}>Reward Name *</div>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Weekly Allowance"
                    value={recurName}
                    onChange={(e) => setRecurName(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Description (optional)</div>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Automatic weekly credit"
                    value={recurDesc}
                    onChange={(e) => setRecurDesc(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Amount (€) *</div>
                  <input
                    style={styles.input}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="5.00"
                    value={recurAmount}
                    onChange={(e) => setRecurAmount(e.target.value)}
                  />
                </div>
                <div>
                  <div style={styles.label}>Frequency *</div>
                  <select style={styles.select} value={recurFreq} onChange={(e) => setRecurFreq(e.target.value as Frequency)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <div style={styles.label}>First grant (optional)</div>
                  <input
                    style={styles.input}
                    type="datetime-local"
                    min={toInputValue(new Date())}
                    value={recurStart}
                    onChange={(e) => setRecurStart(e.target.value)}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--hint)', marginTop: '4px' }}>
                    {startHint(recurFreq, recurStart)}
                  </div>
                </div>
                <div>
                  <div style={styles.label}>Assign to Users (hold Ctrl/Cmd for multiple, empty = all users)</div>
                  <select
                    style={styles.multiSelect}
                    multiple
                    value={recurUsers.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value));
                      setRecurUsers(selected);
                    }}
                  >
                    {users
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.username ? `(@${u.username})` : ''}
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: '12px', color: 'var(--hint)', marginTop: '4px' }}>
                    {recurUsers.length === 0 ? 'Will apply to all active users' : `Selected ${recurUsers.length} user(s)`}
                  </div>
                </div>
                <button type="submit" style={styles.submitBtn}>
                  Create Recurring Reward
                </button>
              </form>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.header}>Active Recurring Rewards ({recurringRewards.filter((r) => r.is_active).length})</div>
            <div style={styles.card}>
              {recurringRewards
                .filter((r) => r.is_active)
                .map((r) => {
                  const assignedCount = r.assigned_user_ids.length;
                  const nextGrant = r.next_grant_date ? new Date(r.next_grant_date).toLocaleString() : 'N/A';

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
                      <button style={styles.actionBtn} onClick={() => handleDeactivate(r.id)}>
                        Deactivate
                      </button>
                    </div>
                  );
                })}
              {recurringRewards.filter((r) => r.is_active).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hint)' }}>
                  No active recurring rewards
                </div>
              )}
            </div>
          </div>

          {recurringRewards.filter((r) => !r.is_active).length > 0 && (
            <div style={styles.section}>
              <div style={styles.header}>Inactive Recurring Rewards</div>
              <div style={styles.card}>
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
                      <button style={styles.actionBtn} onClick={() => handleReactivate(r.id)}>
                        Reactivate
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div style={styles.section}>
          <div style={styles.header}>Recent Grants ({grants.length})</div>
          <div style={styles.card}>
            {grants.map((g) => {
              const grantDate = new Date(g.granted_at).toLocaleString();
              return (
                <div key={g.id} style={styles.rewardRow}>
                  <div style={styles.rewardInfo}>
                    <div style={styles.rewardName}>
                      {g.reward_name} → {g.user_name}
                      {g.granted_by_scheduler && (
                        <span style={{ ...styles.badge, marginLeft: '8px', backgroundColor: '#4caf50', color: '#fff' }}>
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
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hint)' }}>No grants yet</div>
            )}
          </div>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
