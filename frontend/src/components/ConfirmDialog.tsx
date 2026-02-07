const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 200,
    padding: '20px',
  },
  dialog: {
    backgroundColor: 'var(--bg)',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '320px',
    textAlign: 'center' as const,
  },
  emoji: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  title: {
    fontSize: '17px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--hint)',
    marginBottom: '20px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
};

interface Props {
  emoji: string;
  title: string;
  subtitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  emoji,
  title,
  subtitle,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.emoji}>{emoji}</div>
        <div style={styles.title}>{title}</div>
        <div style={styles.subtitle}>{subtitle}</div>
        <div style={styles.buttons}>
          <button style={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button style={styles.confirmBtn} onClick={onConfirm} disabled={loading}>
            {loading ? 'Logging...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
