import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import {
  getSlotMachineAdminStats,
  toggleSlotMachine,
} from '../api/slot-machine';
import type { SlotMachineAdminStats } from '../api/slot-machine';

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
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 16px',
    marginBottom: '8px',
  },
  toggleBtn: {
    display: 'block',
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'ongoing';
  return new Date(dateStr).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminSlotMachinePage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SlotMachineAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!stats) {
    return <div style={styles.empty}>Failed to load statistics.</div>;
  }

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>

      {/* Enable/Disable toggle */}
      <div style={styles.section}>
        <div style={styles.header}>Status</div>
        <button
          style={{
            ...styles.toggleBtn,
            backgroundColor: stats.enabled ? 'var(--destructive)' : '#4caf50',
            opacity: toggling ? 0.5 : 1,
          }}
          onClick={handleToggle}
          disabled={toggling}
        >
          {stats.enabled ? 'Disable Slot Machine' : 'Enable Slot Machine'}
        </button>
      </div>

      {/* Period info */}
      <div style={styles.section}>
        <div style={styles.header}>
          {scope === 'fiscal_period' ? 'Current fiscal period' : 'All Time Period'}
        </div>
        <div style={styles.card}>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Period</span>
            <span style={styles.statValue}>
              {scope === 'fiscal_period'
                ? `${formatDate(stats.period_start)} — ${formatDate(stats.period_end)}`
                : 'All time'}
            </span>
          </div>
        </div>
      </div>

      {/* Scope Toggle */}
      <div style={styles.section}>
        <div style={styles.header}>View Statistics</div>
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
      </div>

      {/* Statistics */}
      <div style={styles.section}>
        <div style={styles.header}>Statistics</div>
        <div style={styles.card}>
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
                color: stats.house_profit >= 0 ? '#4caf50' : 'var(--destructive)',
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
        </div>
      </div>

      {/* Top Winners */}
      <div style={styles.section}>
        <div style={styles.header}>Top Winners ({stats.top_winners.length})</div>
        {stats.top_winners.length === 0 ? (
          <div style={{ ...styles.card, ...styles.empty }}>No spins yet</div>
        ) : (
          <div style={styles.card}>
            {stats.top_winners.map((winner, i) => (
              <div key={winner.user_id}>
                {i > 0 && <div style={styles.separator} />}
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
                      color: winner.net_result >= 0 ? '#4caf50' : 'var(--destructive)',
                    }}
                  >
                    {winner.net_result >= 0 ? '+' : ''}{winner.net_result.toFixed(2)} €
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
