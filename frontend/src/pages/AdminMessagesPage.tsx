import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { listMessageTemplates, updateMessageTemplate } from '../api/messages';
import type { MessageTemplate } from '../types';

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
    padding: '12px 16px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
  },
  eventType: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  variables: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    minHeight: '60px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--section-bg)',
    color: 'var(--text)',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  controls: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: '8px',
    gap: '8px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '8px',
    fontSize: '13px',
    color: 'var(--hint)',
  },
  saveBtn: {
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
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
  backBtn: {
    fontSize: '14px',
    color: 'var(--link)',
    backgroundColor: 'transparent',
    padding: '8px 16px',
    marginBottom: '8px',
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
};

const EVENT_LABELS: Record<string, string> = {
  fiscal_period_closed: 'Fiscal Period Closed',
  user_approved: 'User Approved',
  payment_approved: 'Payment Approved',
  payment_rejected: 'Payment Rejected',
  user_deactivated: 'User Deactivated',
  user_promoted: 'User Promoted',
  user_demoted: 'User Demoted',
  debt_payment_approved: 'Debt Payment Approved',
  debt_payment_rejected: 'Debt Payment Rejected',
};

const EVENT_VARIABLES: Record<string, string> = {
  fiscal_period_closed: '{user}, {amount}',
  user_approved: '{user}',
  payment_approved: '{user}, {amount}',
  payment_rejected: '{user}, {amount}',
  user_deactivated: '{user}',
  user_promoted: '{user}',
  user_demoted: '{user}',
  debt_payment_approved: '{user}, {amount}',
  debt_payment_rejected: '{user}, {amount}',
};

export default function AdminMessagesPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, { template: string; is_active: boolean }>>({});

  useEffect(() => {
    listMessageTemplates()
      .then((t) => {
        setTemplates(t);
        const initial: Record<number, { template: string; is_active: boolean }> = {};
        for (const tpl of t) {
          initial[tpl.id] = { template: tpl.template, is_active: tpl.is_active };
        }
        setEdits(initial);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = async (tpl: MessageTemplate) => {
    const edit = edits[tpl.id];
    if (!edit) return;
    try {
      const updated = await updateMessageTemplate(tpl.id, {
        template: edit.template,
        is_active: edit.is_active,
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showToast('Template saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  if (!user?.is_admin) {
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      <button style={styles.backBtn} onClick={() => navigate('/admin')}>
        ← Back to Admin
      </button>
      <div style={styles.section}>
        <div style={styles.header}>Message Templates</div>
        <div style={styles.card}>
          {templates.map((tpl, i) => {
            const edit = edits[tpl.id];
            const hasChanges = edit && (edit.template !== tpl.template || edit.is_active !== tpl.is_active);
            return (
              <div key={tpl.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <div style={styles.eventType}>
                    {EVENT_LABELS[tpl.event_type] || tpl.event_type}
                  </div>
                  <div style={styles.variables}>
                    Variables: {EVENT_VARIABLES[tpl.event_type] || 'none'}
                  </div>
                  <textarea
                    style={styles.textarea}
                    value={edit?.template ?? tpl.template}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [tpl.id]: { ...prev[tpl.id], template: e.target.value },
                      }))
                    }
                  />
                  <div style={styles.controls}>
                    <label style={styles.toggleRow}>
                      <input
                        type="checkbox"
                        checked={edit?.is_active ?? tpl.is_active}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [tpl.id]: { ...prev[tpl.id], is_active: e.target.checked },
                          }))
                        }
                      />
                      Active
                    </label>
                    {hasChanges && (
                      <button style={styles.saveBtn} onClick={() => handleSave(tpl)}>
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
