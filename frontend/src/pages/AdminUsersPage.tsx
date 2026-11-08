import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  listUsers,
  createUser,
  activateUser,
  deactivateUser,
  promoteUser,
  demoteUser,
  deleteAllNonAdminUsers,
  denyUser,
} from '../api/users';
import type { User } from '../types';
import { Badge, BackButton, Button, Card, Divider, EmptyState, Loading, Section, TextField, useToast } from '../ui';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '8px',
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
};

export default function AdminUsersPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

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

  const handleDenyUser = async (u: User) => {
    if (!confirm(`Deny access for ${u.first_name}? This will permanently remove them from the system.`)) return;
    try {
      await denyUser(u.id);
      showToast(`${u.first_name} denied`);
      fetchUsers();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!currentUser?.is_admin) {
    return <EmptyState>Admin access required.</EmptyState>;
  }

  if (loading) {
    return <Loading />;
  }

  const activeUsers = users.filter((u) => u.is_active);
  const inactiveUsers = users.filter((u) => !u.is_active);

  return (
    <div>
      <BackButton />
      <Section title="Add user">
        <Card padded style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <TextField
            type="number"
            placeholder="Telegram ID"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
          />
          <TextField
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Button onClick={handleAddUser} disabled={!telegramId || !firstName || adding}>
            {adding ? 'Adding...' : 'Add User'}
          </Button>
        </Card>
      </Section>

      <Section title={`Active users (${activeUsers.length})`}>
        <Card>
          {activeUsers.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <Divider />}
              <div style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.name}>
                    {u.first_name}
                    {u.username ? ` (@${u.username})` : ''}
                  </div>
                  <div style={styles.meta}>ID: {u.telegram_id}</div>
                </div>
                {u.is_admin && (
                  <Badge>Admin</Badge>
                )}
                {u.id !== currentUser.id && (
                  <>
                    <Button size="xs" variant="secondary" onClick={() => handleToggleAdmin(u)}>
{u.is_admin ? 'Demote' : 'Promote'}
</Button>
                    <Button size="xs" variant="secondary" tone="destructive" onClick={() => handleToggleActive(u)}>
Deactivate
</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      </Section>

      {inactiveUsers.length > 0 && (
        <Section title={`Pending approval (${inactiveUsers.length})`}>
          <Card>
            {inactiveUsers.map((u, i) => (
              <div key={u.id}>
                {i > 0 && <Divider />}
                <div style={styles.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.name}>
                      {u.first_name}
                      {u.username ? ` (@${u.username})` : ''}
                    </div>
                    <div style={styles.meta}>ID: {u.telegram_id}</div>
                  </div>
                  <Badge tone="muted">Pending</Badge>
                  <Button size="xs" variant="secondary" onClick={() => handleToggleActive(u)}>
Approve
</Button>
                  <Button size="xs" variant="secondary" tone="destructive" onClick={() => handleDenyUser(u)}>
Deny
</Button>
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section>
        <Button block tone="destructive" onClick={handleDeleteAll}>
          Deactivate All Users
        </Button>
      </Section>
    </div>
  );
}
