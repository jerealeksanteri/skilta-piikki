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
}

export default function BalanceDisplay({ balance }: Props) {
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
    </div>
  );
}
