import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  getSlotMachineAdminStats,
  toggleSlotMachine,
} from '../api/slot-machine';
import type { SlotMachineAdminStats } from '../api/slot-machine';
import { BackButton, Button, Card, Divider, EmptyState, Loading, Section, useToast } from '../ui';
import { formatDate } from '../utils/date';

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
  amount: {
    fontSize: '14px',
    fontWeight: 600,
  },
  scopeToggle: {
    display: 'flex',
    backgroundColor: 'var(--secondary-bg)',
    borderRadius: '8px',
    padding: '4px',
    gap: '4px',
  },
  scopeBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: 'var(--hint)',
    transition: 'all 0.2s',
  },
  scopeBtnActive: {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
  },
};

function periodDate(dateStr: string | null): string {
  return dateStr ? formatDate(dateStr) : 'ongoing';
}

export default function AdminSlotMachinePage() {
  const { user } = useUser();
  const [stats, setStats] = useState<SlotMachineAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();
  const [toggling, setToggling] = useState(false);
  const [scope, setScope] = useState<'fiscal_period' | 'all_time'>('fiscal_period');

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getSlotMachineAdminStats(scope);
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [scope]);


  const handleToggle = async () => {
    if (!stats || toggling) return;
    const newEnabled = !stats.enabled;
    const action = newEnabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} the slot machine?`)) return;

    setToggling(true);
    try {
      await toggleSlotMachine(newEnabled);
      setStats({ ...stats, enabled: newEnabled });
      showToast(`Slot machine ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  if (!user?.is_admin) {
    return <EmptyState>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
  }

  if (!stats) {
    return <div style={styles.empty}>Failed to load statistics.</div>;
  }

  return (
    <div>
      <BackButton />

      {/* Enable/Disable toggle */}
      <Section title="Status">
        <Button
          size="lg"
          block
          tone={stats.enabled ? 'destructive' : 'positive'}
          onClick={handleToggle}
          disabled={toggling}
        >
          {stats.enabled ? 'Disable Slot Machine' : 'Enable Slot Machine'}
        </Button>
      </Section>

      {/* Period info */}
      <Section title={scope === 'fiscal_period' ? 'Current fiscal period' : 'All Time Period'}>
        <Card>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Period</span>
            <span style={styles.statValue}>
              {scope === 'fiscal_period'
                ? `${periodDate(stats.period_start)} — ${periodDate(stats.period_end)}`
                : 'All time'}
            </span>
          </div>
        </Card>
      </Section>

      {/* Scope Toggle */}
      <Section title="View Statistics">
        <div style={styles.scopeToggle}>
          <button
            style={{
              ...styles.scopeBtn,
              ...(scope === 'fiscal_period' ? styles.scopeBtnActive : {}),
            }}
            onClick={() => setScope('fiscal_period')}
          >
            Current Period
          </button>
          <button
            style={{
              ...styles.scopeBtn,
              ...(scope === 'all_time' ? styles.scopeBtnActive : {}),
            }}
            onClick={() => setScope('all_time')}
          >
            All Time
          </button>
        </div>
      </Section>

      {/* Statistics */}
      <Section title="Statistics">
        <Card>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Total Spins</span>
            <span style={styles.statValue}>{stats.total_spins}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Total Bet</span>
            <span style={styles.statValue}>{stats.total_bet.toFixed(2)} €</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Total Won</span>
            <span style={styles.statValue}>{stats.total_won.toFixed(2)} €</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>House Profit</span>
            <span
              style={{
                ...styles.statValue,
                color: stats.house_profit >= 0 ? 'var(--positive)' : 'var(--destructive)',
              }}
            >
              {stats.house_profit >= 0 ? '+' : ''}{stats.house_profit.toFixed(2)} €
            </span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Actual RTP</span>
            <span style={styles.statValue}>{stats.actual_rtp.toFixed(2)}%</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Theoretical RTP</span>
            <span style={styles.statValue}>{stats.theoretical_rtp.toFixed(2)}%</span>
          </div>
        </Card>
      </Section>

      {/* Top Winners */}
      <Section title={`Top Winners (${stats.top_winners.length})`}>
        {stats.top_winners.length === 0 ? (
          <Card>
            <EmptyState>No spins yet</EmptyState>
          </Card>
        ) : (
          <Card>
            {stats.top_winners.map((winner, i) => (
              <div key={winner.user_id}>
                {i > 0 && <Divider />}
                <div style={styles.row}>
                  <div style={styles.info}>
                    <div style={styles.label}>{winner.user_name}</div>
                    <div style={styles.meta}>
                      {winner.total_spins} spins · Bet {winner.total_bet.toFixed(2)} € · Won {winner.total_won.toFixed(2)} €
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.amount,
                      color: winner.net_result >= 0 ? 'var(--positive)' : 'var(--destructive)',
                    }}
                  >
                    {winner.net_result >= 0 ? '+' : ''}{winner.net_result.toFixed(2)} €
                  </span>
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}
