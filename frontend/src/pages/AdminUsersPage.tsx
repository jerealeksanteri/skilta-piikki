import { useEffect, useState } from 'react';
import { useUser } from '../App';
import {
  listUsers,
  createUser,
  activateUser,
  deactivateUser,
  promoteUser,
  demoteUser,
  deleteAllNonAdminUsers,
} from '../api/users';
import type { User } from '../types';

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
    gap: '8px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
  },
  name: {
    flex: 1,
    fontSize: '15px',
    fontWeight: 500,
    minWidth: 0,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--hint)',
    marginTop: '2px',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '6px',
    fontWeight: 600,
  },
  adminBadge: {
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
  inactiveBadge: {
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--hint)',
  },
  actionBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  dangerBtn: {
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--destructive)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '16px',
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
  },
  input: {
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: '15px',
    outline: 'none',
  },
  submitBtn: {
    padding: '12px',
    borderRadius: '10px',
    fontSize: '15px',
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

export default function AdminUsersPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Add user form
  const [telegramId, setTelegramId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    try {
      const u = await listUsers();
      setUsers(u);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddUser = async () => {
    if (!telegramId || !firstName) return;
    setAdding(true);
    try {
      await createUser({
        telegram_id: parseInt(telegramId, 10),
        first_name: firstName,
      });
      setTelegramId('');
      setFirstName('');
      showToast('User added');
      fetchUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      if (u.is_active) {
        await deactivateUser(u.id);
        showToast(`${u.first_name} deactivated`);
      } else {
        await activateUser(u.id);
        showToast(`${u.first_name} approved`);
      }
      fetchUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleToggleAdmin = async (u: User) => {
    try {
      if (u.is_admin) {
        await demoteUser(u.id);
        showToast(`${u.first_name} demoted`);
      } else {
        await promoteUser(u.id);
        showToast(`${u.first_name} promoted to admin`);
      }
      fetchUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Deactivate ALL non-admin users and reset their balances to 0? This cannot be undone.')) return;
    try {
      const result = await deleteAllNonAdminUsers();
      showToast(`${result.deactivated} users deactivated`);
      fetchUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!currentUser?.is_admin) {
    return <div style={styles.empty}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const activeUsers = users.filter((u) => u.is_active);
  const inactiveUsers = users.filter((u) => !u.is_active);

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.header}>Add user</div>
        <div style={styles.form}>
          <input
            style={styles.input}
            type="number"
            placeholder="Telegram ID"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
          />
          <input
            style={styles.input}
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <button
            style={{
              ...styles.submitBtn,
              opacity: !telegramId || !firstName || adding ? 0.6 : 1,
            }}
            onClick={handleAddUser}
            disabled={!telegramId || !firstName || adding}
          >
            {adding ? 'Adding...' : 'Add User'}
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.header}>Active users ({activeUsers.length})</div>
        <div style={styles.card}>
          {activeUsers.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <div style={styles.separator} />}
              <div style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.name}>
                    {u.first_name}
                    {u.username ? ` (@${u.username})` : ''}
                  </div>
                  <div style={styles.meta}>ID: {u.telegram_id}</div>
                </div>
                {u.is_admin && (
                  <span style={{ ...styles.badge, ...styles.adminBadge }}>Admin</span>
                )}
                {u.id !== currentUser.id && (
                  <>
                    <button
                      style={styles.actionBtn}
                      onClick={() => handleToggleAdmin(u)}
                    >
                      {u.is_admin ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      style={{ ...styles.actionBtn, ...styles.dangerBtn }}
                      onClick={() => handleToggleActive(u)}
                    >
                      Deactivate
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {inactiveUsers.length > 0 && (
        <div style={styles.section}>
          <div style={styles.header}>Pending approval ({inactiveUsers.length})</div>
          <div style={styles.card}>
            {inactiveUsers.map((u, i) => (
              <div key={u.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.name}>
                      {u.first_name}
                      {u.username ? ` (@${u.username})` : ''}
                    </div>
                    <div style={styles.meta}>ID: {u.telegram_id}</div>
                  </div>
                  <span style={{ ...styles.badge, ...styles.inactiveBadge }}>Pending</span>
                  <button
                    style={styles.actionBtn}
                    onClick={() => handleToggleActive(u)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.section}>
        <button
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 600,
            backgroundColor: 'var(--destructive)',
            color: '#fff',
          }}
          onClick={handleDeleteAll}
        >
          Deactivate All Users
        </button>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}
