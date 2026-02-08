const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '32px',
    textAlign: 'center' as const,
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--hint)',
    lineHeight: 1.5,
  },
};

export default function PendingApprovalPage() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>⏳</div>
      <div style={styles.title}>Access Pending</div>
      <div style={styles.subtitle}>
        Your account is waiting for admin approval.
        <br />
        You'll get access once an admin approves you.
      </div>
    </div>
  );
}
