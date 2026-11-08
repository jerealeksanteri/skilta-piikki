import { useEffect, useState } from 'react';
import { getLedgerCheck, runLedgerCheck } from '../api/ledger';
import type { LedgerCheck } from '../types';

const styles = {
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '12px 16px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: '20px',
    lineHeight: '20px',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: 500,
  },
  detail: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  row: {
    fontSize: '13px',
    marginTop: '4px',
  },
  button: {
    fontSize: '13px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '2px 0',
    flexShrink: 0,
  },
};

function euros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Whether every balance still equals the sum of its transactions (checked nightly). */
export default function LedgerStatus() {
  const [check, setCheck] = useState<LedgerCheck | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLedgerCheck()
      .then(setCheck)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the balance check'));
  }, []);

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      setCheck(await runLedgerCheck());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Balance check failed');
    } finally {
      setRunning(false);
    }
  };

  if (!check && !error) return null;

  const failing = (check?.mismatches.length ?? 0) > 0;
  const icon = error || failing ? '⚠️' : check?.checked_at ? '✅' : '⏳';
  let title: string;
  if (error) title = error;
  else if (!check?.checked_at) title = "Balances haven't been checked yet";
  else if (failing) title = `${check.mismatches.length} balance(s) don't match their transactions`;
  else title = `All ${check.users_checked} balances match their transactions`;

  return (
    <div style={{ ...styles.card, border: failing ? '1px solid var(--destructive)' : '1px solid transparent' }}>
      <div style={styles.icon}>{icon}</div>
      <div style={styles.body}>
        <div style={{ ...styles.title, color: failing ? 'var(--destructive)' : 'var(--text)' }}>{title}</div>
        {check?.checked_at && <div style={styles.detail}>Checked {when(check.checked_at)} · runs every night</div>}
        {check?.mismatches.map((m) => (
          <div key={m.user_id} style={styles.row}>
            {m.user_name}: balance {euros(m.balance)}, transactions {euros(m.ledger_total)} (off by{' '}
            {euros(m.difference)})
          </div>
        ))}
      </div>
      <button style={styles.button} onClick={runNow} disabled={running}>
        {running ? 'Checking…' : 'Check now'}
      </button>
    </div>
  );
}
