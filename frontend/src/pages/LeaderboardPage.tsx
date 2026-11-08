import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getLeaderboard } from '../api/users';
import type { User } from '../types';
import { Card, Divider, Loading, Section } from '../ui';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center' as const,
    padding: '12px 16px',
    gap: '12px',
  },
  rank: {
    fontSize: '16px',
    fontWeight: 700,
    width: '28px',
    textAlign: 'center' as const,
  },
  name: {
    flex: 1,
    fontSize: '15px',
    fontWeight: 500,
  },
  balance: {
    fontSize: '15px',
    fontWeight: 600,
  },
  highlight: {
    backgroundColor: 'color-mix(in srgb, var(--btn) 10%, transparent)',
  },
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loading />;
  }

  const blacklisted = users.filter((u) => u.balance <= -50);

  return (
    <div>
      {blacklisted.length > 0 && (
        <Section title="💀 Blacklist" titleTone="destructive">
          <Card style={{ border: '1px solid var(--destructive)' }}>
            {blacklisted.map((u, i) => {
              const isCurrentUser = u.id === currentUser?.id;
              return (
                <div key={u.id}>
                  {i > 0 && <Divider />}
                  <div
                    style={{
                      ...styles.row,
                      ...(isCurrentUser ? styles.highlight : {}),
                    }}
                  >
                    <span style={styles.rank}>💀</span>
                    <span style={styles.name}>
                      {u.first_name}
                      {isCurrentUser ? ' (you)' : ''}
                    </span>
                    <span style={{ ...styles.balance, color: 'var(--destructive)' }}>
                      {u.balance.toFixed(2)} €
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      <Section title="Ranking">
        <Card>
          {users.map((u, i) => {
            const isCurrentUser = u.id === currentUser?.id;
            return (
              <div key={u.id}>
                {i > 0 && <Divider />}
                <div
                  style={{
                    ...styles.row,
                    ...(isCurrentUser ? styles.highlight : {}),
                  }}
                >
                  <span style={styles.rank}>
                    {i < 3 ? RANK_ICONS[i] : `${i + 1}.`}
                  </span>
                  <span style={styles.name}>
                    {u.first_name}
                    {isCurrentUser ? ' (you)' : ''}
                  </span>
                  <span
                    style={{
                      ...styles.balance,
                      color: u.balance < 0 ? 'var(--destructive)' : 'var(--positive)',
                    }}
                  >
                    {u.balance.toFixed(2)} €
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      </Section>
    </div>
  );
}
