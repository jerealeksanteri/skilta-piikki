import { useEffect, useState } from 'react';
import { useUser } from '../App';
import { getLeaderboard } from '../api/users';
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
    gap: '12px',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--secondary-bg)',
    marginLeft: '16px',
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
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--hint)',
    fontSize: '14px',
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
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      <div style={styles.section}>
        <div style={styles.header}>Ranking</div>
        <div style={styles.card}>
          {users.map((u, i) => {
            const isCurrentUser = u.id === currentUser?.id;
            return (
              <div key={u.id}>
                {i > 0 && <div style={styles.separator} />}
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
                      color: u.balance < 0 ? 'var(--destructive)' : '#4caf50',
                    }}
                  >
                    {u.balance.toFixed(2)} €
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
