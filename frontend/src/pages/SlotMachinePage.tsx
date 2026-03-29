import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { spinSlotMachine, getSlotMachineStats, getSlotMachineStatus } from '../api/slot-machine';
import type { SlotMachineStats } from '../api/slot-machine';

const styles = {
  container: {
    padding: '16px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 0',
    marginBottom: '8px',
  },
  header: {
    fontSize: '24px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
  },
  slotMachine: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  reel: {
    width: '80px',
    height: '100px',
    backgroundColor: 'var(--secondary-bg)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    border: '3px solid var(--btn)',
    transition: 'transform 0.1s',
  },
  reelSpinning: {
    animation: 'spin 0.1s linear infinite',
  },
  spinBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
    marginBottom: '16px',
  },
  spinBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  result: {
    textAlign: 'center' as const,
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    minHeight: '28px',
  },
  win: {
    color: '#4caf50',
  },
  lose: {
    color: '#f44336',
  },
  stats: {
    fontSize: '14px',
    color: 'var(--hint)',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  statLabel: {
    color: 'var(--hint)',
  },
  statValue: {
    fontWeight: 600,
    color: 'var(--text)',
  },
  balance: {
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center' as const,
    marginBottom: '16px',
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
  },
};

const SYMBOL_EMOJIS: Record<string, string> = {
  cherry: '🍒',
  lemon: '🍋',
  orange: '🍊',
  plum: '🍇',
  bell: '🔔',
  seven: '7️⃣',
};

export default function SlotMachinePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [symbols, setSymbols] = useState<string[]>(['cherry', 'lemon', 'orange']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<SlotMachineStats | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const s = await getSlotMachineStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (!user || user.balance < -49) {
      showToast('You have reached the blacklist limit (-50€). Cannot gamble further!');
      return;
    }

    setSpinning(true);
    setResult(null);

    // Animate spinning for 2 seconds
    const spinDuration = 2000;
    const spinInterval = 100;
    let elapsed = 0;

    const intervalId = setInterval(() => {
      setSymbols([
        Object.keys(SYMBOL_EMOJIS)[Math.floor(Math.random() * 6)],
        Object.keys(SYMBOL_EMOJIS)[Math.floor(Math.random() * 6)],
        Object.keys(SYMBOL_EMOJIS)[Math.floor(Math.random() * 6)],
      ]);
      elapsed += spinInterval;

      if (elapsed >= spinDuration) {
        clearInterval(intervalId);
      }
    }, spinInterval);

    try {
      const response = await spinSlotMachine();

      // Wait for animation to complete
      setTimeout(() => {
        setSymbols(response.symbols);
        setSpinning(false);

        if (response.win_amount > 0) {
          setResult(`🎉 You won ${response.win_amount.toFixed(2)}€!`);
          if (response.win_amount === 50) {
            showToast('🎰 JACKPOT! 🎰');
          }
        } else {
          setResult(`Better luck next time!`);
        }

        refreshUser();
        fetchStats();
      }, spinDuration);
    } catch (e) {
      clearInterval(intervalId);
      setSpinning(false);
      showToast(e instanceof Error ? e.message : 'Failed to spin');
    }
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '32px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div style={styles.header}>🎰 Slot Machine 🎰</div>

      <div style={styles.card}>
        <div style={styles.balance}>Your Balance: {user.balance.toFixed(2)}€</div>

        <div style={styles.slotMachine}>
          {symbols.map((symbol, i) => (
            <div
              key={i}
              style={{
                ...styles.reel,
                ...(spinning ? { filter: 'blur(2px)' } : {}),
              }}
            >
              {SYMBOL_EMOJIS[symbol] || '❓'}
            </div>
          ))}
        </div>

        <button
          style={{
            ...styles.spinBtn,
            ...(spinning || user.balance < -49 ? styles.spinBtnDisabled : {}),
          }}
          onClick={handleSpin}
          disabled={spinning || user.balance < -49}
        >
          {spinning ? 'Spinning...' : 'Spin (1€)'}
        </button>

        {result && (
          <div
            style={{
              ...styles.result,
              ...(result.includes('won') ? styles.win : styles.lose),
            }}
          >
            {result}
          </div>
        )}
      </div>

      {stats && (
        <div style={styles.card}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Your Statistics</div>
          <div style={styles.stats}>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Total Spins:</span>
              <span style={styles.statValue}>{stats.total_spins}</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Total Bet:</span>
              <span style={styles.statValue}>{stats.total_bet.toFixed(2)}€</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Total Won:</span>
              <span style={styles.statValue}>{stats.total_won.toFixed(2)}€</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Net Result:</span>
              <span
                style={{
                  ...styles.statValue,
                  color: stats.net_result >= 0 ? '#4caf50' : '#f44336',
                }}
              >
                {stats.net_result >= 0 ? '+' : ''}
                {stats.net_result.toFixed(2)}€
              </span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Biggest Win:</span>
              <span style={styles.statValue}>{stats.biggest_win.toFixed(2)}€</span>
            </div>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Payouts</div>
        <div style={styles.stats}>
          <div style={styles.statRow}>
            <span>🍒 🍒 🍒</span>
            <span style={styles.statValue}>4€</span>
          </div>
          <div style={styles.statRow}>
            <span>🍋 🍋 🍋</span>
            <span style={styles.statValue}>7€</span>
          </div>
          <div style={styles.statRow}>
            <span>🍊 🍊 🍊</span>
            <span style={styles.statValue}>12€</span>
          </div>
          <div style={styles.statRow}>
            <span>🍇 🍇 🍇</span>
            <span style={styles.statValue}>22€</span>
          </div>
          <div style={styles.statRow}>
            <span>🔔 🔔 🔔</span>
            <span style={styles.statValue}>37€</span>
          </div>
          <div style={styles.statRow}>
            <span>7️⃣ 7️⃣ 7️⃣</span>
            <span style={styles.statValue}>50€ JACKPOT</span>
          </div>
          <div style={styles.statRow}>
            <span>Any 2 matching</span>
            <span style={styles.statValue}>1€ (return bet)</span>
          </div>
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
