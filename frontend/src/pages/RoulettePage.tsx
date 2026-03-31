import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { spinRoulette, getRouletteStats, getRouletteStatus } from '../api/roulette';
import type { RouletteBet, RouletteBetResult, RouletteStats } from '../api/roulette';

// European roulette wheel order
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Real European roulette colors
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const getColor = (n: number): 'red' | 'black' | 'green' => {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
};

const COLOR_MAP = {
  red: '#e53935',
  black: '#212121',
  green: '#2e7d32',
};

const CHIP_VALUES = [0.1, 0.25, 0.5, 1.0];

// Table grid: rows 1-12, each row has 3 numbers
const TABLE_ROWS: number[][] = [];
for (let r = 0; r < 12; r++) {
  const start = r * 3 + 1;
  TABLE_ROWS.push([start, start + 1, start + 2]);
}

interface PlacedBet {
  key: string; // unique key for deduplication
  bet_type: string;
  bet_value: string;
  amount: number;
  label: string;
}

export default function RoulettePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [selectedChip, setSelectedChip] = useState(0.25);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ number: number; color: string; results: RouletteBetResult[]; total_win: number } | null>(null);
  const [stats, setStats] = useState<RouletteStats | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastNumbers, setLastNumbers] = useState<number[]>([]);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats();
    getRouletteStatus().then((s) => setEnabled(s.enabled)).catch(() => {});
  }, []);

  const fetchStats = async () => {
    try {
      const s = await getRouletteStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  const placeBet = (key: string, bet_type: string, bet_value: string, label: string) => {
    if (spinning) return;
    setBets((prev) => {
      const existing = prev.find((b) => b.key === key);
      if (existing) {
        return prev.map((b) => (b.key === key ? { ...b, amount: Math.round((b.amount + selectedChip) * 100) / 100 } : b));
      }
      return [...prev, { key, bet_type, bet_value, amount: selectedChip, label }];
    });
  };

  const clearBets = () => {
    if (spinning) return;
    setBets([]);
    setResult(null);
  };

  const handleSpin = async () => {
    if (spinning || bets.length === 0 || !enabled) return;
    if (!user || user.balance < -49) {
      showToast('Blacklist limit reached (-50€)!');
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const apiBets: RouletteBet[] = bets.map((b) => ({
        bet_type: b.bet_type,
        bet_value: b.bet_value,
        amount: b.amount,
      }));

      const response = await spinRoulette(apiBets);

      // Calculate wheel rotation to land on the winning number
      const winIndex = WHEEL_NUMBERS.indexOf(response.number);
      const segmentAngle = 360 / 37;
      // Target: center of winning segment at top (where ball indicator is)
      const targetFinalAngle = (360 - (winIndex + 0.5) * segmentAngle + 360) % 360;
      const currentAngle = wheelRotation % 360;
      const delta = (targetFinalAngle - currentAngle + 360) % 360;
      const fullSpins = 5 + Math.floor(Math.random() * 3);
      const newRotation = wheelRotation + fullSpins * 360 + delta;
      setWheelRotation(newRotation);

      // Wait for animation
      setTimeout(() => {
        setResult({
          number: response.number,
          color: response.color,
          results: response.results,
          total_win: response.total_win,
        });
        setLastNumbers((prev) => [response.number, ...prev.slice(0, 9)]);
        setSpinning(false);
        refreshUser();
        fetchStats();
        setBets([]);
      }, 3000);
    } catch (e) {
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

      <div style={styles.header}>Roulette</div>

      <div style={styles.balance}>Balance: {user.balance.toFixed(2)}€</div>

      {/* Roulette Wheel */}
      <div style={styles.wheelContainer}>
        <div style={styles.wheelOuter}>
          <div style={styles.ballIndicator}>▼</div>
          <div
            ref={wheelRef}
            style={{
              ...styles.wheel,
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning ? 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 300 300" style={{ position: 'absolute', width: '100%', height: '100%' }}>
              {WHEEL_NUMBERS.map((num, i) => {
                const segAngle = 360 / 37;
                const startAngle = i * segAngle - 90;
                const endAngle = (i + 1) * segAngle - 90;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const outerR = 150;
                const innerR = 100;
                const cx = 150;
                const cy = 150;
                const x1 = cx + outerR * Math.cos(startRad);
                const y1 = cy + outerR * Math.sin(startRad);
                const x2 = cx + outerR * Math.cos(endRad);
                const y2 = cy + outerR * Math.sin(endRad);
                const x3 = cx + innerR * Math.cos(endRad);
                const y3 = cy + innerR * Math.sin(endRad);
                const x4 = cx + innerR * Math.cos(startRad);
                const y4 = cy + innerR * Math.sin(startRad);
                const color = getColor(num);
                // Text position: middle of the segment arc, at midpoint radius
                const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
                const textR = (outerR + innerR) / 2;
                const tx = cx + textR * Math.cos(midAngle);
                const ty = cy + textR * Math.sin(midAngle);
                const textRotation = (startAngle + endAngle) / 2 + 90;
                return (
                  <g key={num}>
                    <path
                      d={`M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`}
                      fill={COLOR_MAP[color]}
                      stroke="#1a1a1a"
                      strokeWidth="0.5"
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill="#fff"
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                    >
                      {num}
                    </text>
                  </g>
                );
              })}
              <circle cx="150" cy="150" r="100" fill="#1a1a1a" />
              <circle cx="150" cy="150" r="94" fill="#2a2a2a" />
              <circle cx="150" cy="150" r="40" fill="#8b6914" stroke="#d4a829" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Result display */}
      {result && (
        <div style={styles.resultContainer}>
          <div
            style={{
              ...styles.resultNumber,
              backgroundColor: COLOR_MAP[getColor(result.number)],
            }}
          >
            {result.number}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '8px' }}>
            {result.total_win > 0 ? (
              <span style={{ color: '#4caf50' }}>Won {result.total_win.toFixed(2)}€!</span>
            ) : (
              <span style={{ color: '#f44336' }}>No win</span>
            )}
          </div>
          {result.total_win > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--hint)', marginTop: '4px' }}>
              {result.results.filter((r) => r.payout > 0).map((r, i) => (
                <div key={i}>{r.bet_type} ({r.bet_value}): +{r.payout.toFixed(2)}€</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last numbers */}
      {lastNumbers.length > 0 && (
        <div style={styles.lastNumbers}>
          {lastNumbers.map((n, i) => (
            <div
              key={i}
              style={{
                ...styles.lastNumberDot,
                backgroundColor: COLOR_MAP[getColor(n)],
              }}
            >
              {n}
            </div>
          ))}
        </div>
      )}

      {/* Chip selector */}
      <div style={styles.chipSelector}>
        {CHIP_VALUES.map((val) => (
          <button
            key={val}
            onClick={() => setSelectedChip(val)}
            style={{
              ...styles.chip,
              ...(selectedChip === val ? styles.chipSelected : {}),
            }}
          >
            {val < 1 ? val.toFixed(2) : val.toFixed(0)}€
          </button>
        ))}
      </div>

      {/* Disabled message */}
      {!enabled && (
        <div style={styles.disabledMsg}>Roulette is currently disabled.</div>
      )}

      {/* Betting Board */}
      <div style={styles.board}>
        {/* Zero */}
        <button
          style={{
            ...styles.boardCell,
            ...styles.zeroCell,
            gridColumn: '1 / 2',
            gridRow: '1 / 4',
          }}
          onClick={() => placeBet('straight-0', 'Straight', '0', '0')}
        >
          0
          {getBetChip(bets, 'straight-0')}
        </button>

        {/* Number grid: 3 rows x 12 columns */}
        {TABLE_ROWS.map((row, rowIdx) => (
          row.map((num) => {
            const col = ((num - 1) % 3); // 0, 1, 2
            const gridRow = 3 - col; // row 3=col1, row 2=col2, row 1=col3
            const gridCol = rowIdx + 2; // columns 2-13
            const color = getColor(num);
            return (
              <button
                key={num}
                style={{
                  ...styles.boardCell,
                  backgroundColor: COLOR_MAP[color],
                  gridColumn: `${gridCol} / ${gridCol + 1}`,
                  gridRow: `${gridRow} / ${gridRow + 1}`,
                }}
                onClick={() => placeBet(`straight-${num}`, 'Straight', String(num), String(num))}
              >
                {num}
                {getBetChip(bets, `straight-${num}`)}
              </button>
            );
          })
        ))}

        {/* Column bets (2:1) */}
        {[3, 2, 1].map((col, i) => (
          <button
            key={`col-${col}`}
            style={{
              ...styles.boardCell,
              ...styles.outsideCell,
              gridColumn: '14 / 15',
              gridRow: `${i + 1} / ${i + 2}`,
              fontSize: '10px',
            }}
            onClick={() => placeBet(`column-${col}`, 'Column', String(col), `Col ${col}`)}
          >
            2:1
            {getBetChip(bets, `column-${col}`)}
          </button>
        ))}

        {/* Dozen bets */}
        {[1, 2, 3].map((dozen) => (
          <button
            key={`dozen-${dozen}`}
            style={{
              ...styles.boardCell,
              ...styles.outsideCell,
              gridColumn: `${(dozen - 1) * 4 + 2} / ${(dozen - 1) * 4 + 6}`,
              gridRow: '4 / 5',
            }}
            onClick={() => placeBet(`dozen-${dozen}`, 'Dozen', String(dozen), `${dozen === 1 ? '1st' : dozen === 2 ? '2nd' : '3rd'} 12`)}
          >
            {dozen === 1 ? '1st 12' : dozen === 2 ? '2nd 12' : '3rd 12'}
            {getBetChip(bets, `dozen-${dozen}`)}
          </button>
        ))}

        {/* Bottom outside bets */}
        {[
          { key: 'low', type: 'Low/High', value: 'Low', label: '1-18' },
          { key: 'even', type: 'Even/Odd', value: 'Even', label: 'EVEN' },
          { key: 'red', type: 'Red/Black', value: 'Red', label: '◆', isRed: true },
          { key: 'black', type: 'Red/Black', value: 'Black', label: '◆', isBlack: true },
          { key: 'odd', type: 'Even/Odd', value: 'Odd', label: 'ODD' },
          { key: 'high', type: 'Low/High', value: 'High', label: '19-36' },
        ].map((bet, i) => {
          const colStart = Math.floor(i * 12 / 6) + 2;
          const colEnd = Math.floor((i + 1) * 12 / 6) + 2;
          return (
            <button
              key={bet.key}
              style={{
                ...styles.boardCell,
                ...styles.outsideCell,
                gridColumn: `${colStart} / ${colEnd}`,
                gridRow: '5 / 6',
                ...(bet.isRed ? { backgroundColor: COLOR_MAP.red } : {}),
                ...(bet.isBlack ? { backgroundColor: COLOR_MAP.black } : {}),
              }}
              onClick={() => placeBet(bet.key, bet.type, bet.value, bet.label)}
            >
              {bet.label}
              {getBetChip(bets, bet.key)}
            </button>
          );
        })}
      </div>

      {/* Placed bets summary */}
      {bets.length > 0 && (
        <div style={styles.betsCard}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Bets ({bets.length}) — Total: {totalBet.toFixed(2)}€
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {bets.map((b) => (
              <span key={b.key} style={styles.betTag}>
                {b.label}: {b.amount.toFixed(2)}€
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: '0 16px', display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          style={{
            ...styles.clearBtn,
            opacity: bets.length === 0 || spinning ? 0.5 : 1,
          }}
          onClick={clearBets}
          disabled={bets.length === 0 || spinning}
        >
          Clear
        </button>
        <button
          style={{
            ...styles.spinBtn,
            opacity: bets.length === 0 || spinning || !enabled ? 0.5 : 1,
          }}
          onClick={handleSpin}
          disabled={bets.length === 0 || spinning || !enabled}
        >
          {spinning ? 'Spinning...' : `Spin (${totalBet.toFixed(2)}€)`}
        </button>
      </div>

      {/* Stats */}
      {stats && stats.total_spins > 0 && (
        <div style={styles.card}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Your Statistics</div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Total Spins:</span>
            <span style={styles.statValue}>{stats.total_spins}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Biggest Win:</span>
            <span style={styles.statValue}>{stats.biggest_win.toFixed(2)}€</span>
          </div>
        </div>
      )}

      {/* Payouts info */}
      <div style={styles.card}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Payouts</div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Straight (1 number)</span>
          <span style={styles.statValue}>35:1</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Dozen / Column</span>
          <span style={styles.statValue}>2:1</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>Red/Black, Even/Odd, Low/High</span>
          <span style={styles.statValue}>1:1</span>
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function getBetChip(bets: PlacedBet[], key: string) {
  const bet = bets.find((b) => b.key === key);
  if (!bet) return null;
  return (
    <div style={chipOverlayStyle}>
      {bet.amount.toFixed(2)}
    </div>
  );
}

const chipOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: '#ffd700',
  color: '#000',
  fontSize: '7px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px solid #fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
  zIndex: 5,
  pointerEvents: 'none',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 0',
    marginBottom: '8px',
    border: 'none',
    textAlign: 'left',
  },
  header: {
    fontSize: '24px',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '8px',
  },
  balance: {
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '16px',
  },
  wheelContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  wheelOuter: {
    position: 'relative',
    width: '300px',
    height: '300px',
  },
  ballIndicator: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '18px',
    color: '#ffd700',
    zIndex: 10,
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  wheel: {
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    position: 'relative',
    border: '6px solid #8b6914',
    boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 15px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  resultContainer: {
    textAlign: 'center',
    marginBottom: '16px',
  },
  resultNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    border: '3px solid #ffd700',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  lastNumbers: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  lastNumberDot: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
  },
  chipSelector: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  chip: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 700,
    border: '3px solid var(--hint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  chipSelected: {
    border: '3px solid #ffd700',
    backgroundColor: '#ffd700',
    color: '#000',
    boxShadow: '0 0 12px rgba(255, 215, 0, 0.5)',
  },
  disabledMsg: {
    textAlign: 'center',
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: 'var(--secondary-bg)',
    borderRadius: '12px',
    fontSize: '14px',
    color: 'var(--destructive)',
    fontWeight: 500,
  },
  board: {
    display: 'grid',
    gridTemplateColumns: '36px repeat(12, 1fr) 36px',
    gridTemplateRows: 'repeat(3, 40px) 32px 32px',
    gap: '2px',
    margin: '0 0 16px',
    padding: '0 4px',
  },
  boardCell: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    padding: 0,
    minWidth: 0,
    background: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  zeroCell: {
    backgroundColor: COLOR_MAP.green,
    fontSize: '16px',
  },
  outsideCell: {
    backgroundColor: '#333',
    fontSize: '11px',
    fontWeight: 600,
  },
  betsCard: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '12px 16px',
    margin: '0 0 12px',
  },
  betTag: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  spinBtn: {
    flex: 1,
    padding: '16px',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: 600,
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
  },
  clearBtn: {
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    border: 'none',
  },
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  statLabel: {
    color: 'var(--hint)',
    fontSize: '14px',
  },
  statValue: {
    fontWeight: 600,
    color: 'var(--text)',
    fontSize: '14px',
  },
  toast: {
    position: 'fixed',
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
    whiteSpace: 'nowrap',
  },
};
