const styles = {
  container: {
    padding: '24px 16px',
    textAlign: 'center' as const,
  },
  label: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginBottom: '4px',
  },
  amount: {
    fontSize: '36px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  subtext: {
    fontSize: '13px',
    color: 'var(--hint)',
    marginTop: '4px',
  },
};

interface Props {
  balance: number;
  fiscalDebtTotal?: number;
  rank?: number;
  totalUsers?: number;
}

export default function BalanceDisplay({ balance, fiscalDebtTotal, rank, totalUsers }: Props) {
  const isNegative = balance < 0;
  const displayAmount = Math.abs(balance).toFixed(2);

  return (
    <div style={styles.container}>
      <div style={styles.label}>Your balance</div>
      <div
        style={{
          ...styles.amount,
          color: isNegative ? 'var(--destructive)' : '#4caf50',
        }}
      >
        {isNegative ? '-' : ''}{displayAmount} €
      </div>
      <div style={styles.subtext}>
        {isNegative
          ? `You owe ${displayAmount} €`
          : balance === 0
            ? 'All settled!'
            : `${displayAmount} € credit`}
      </div>
      {fiscalDebtTotal !== undefined && fiscalDebtTotal > 0 && (
        <div style={{ ...styles.subtext, marginTop: '2px' }}>
          Includes {fiscalDebtTotal.toFixed(2)} € from previous periods
        </div>
      )}
      {rank !== undefined && totalUsers !== undefined && (
        <div style={{ ...styles.subtext, marginTop: '8px', fontWeight: 600, color: 'var(--text)' }}>
          Rank: {rank}/{totalUsers}
        </div>
      )}
    </div>
  );
}
