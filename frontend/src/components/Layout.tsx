import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../App';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
  },
  content: {
    flex: 1,
    paddingBottom: '72px',
  },
  nav: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    backgroundColor: 'var(--bg)',
    borderTop: '1px solid var(--secondary-bg)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 100,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    padding: '8px 0',
    fontSize: '11px',
    color: 'var(--hint)',
    backgroundColor: 'transparent',
    transition: 'color 0.2s',
  },
  tabActive: {
    color: 'var(--btn)',
  },
  tabIcon: {
    fontSize: '22px',
    marginBottom: '2px',
  },
};

interface Tab {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/history', label: 'History', icon: '📋' },
  { path: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  const visibleTabs = TABS.filter((t) => !t.adminOnly || user?.is_admin);

  return (
    <div style={styles.container}>
      <div style={styles.content}>{children}</div>
      <nav style={styles.nav}>
        {visibleTabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
            >
              <span style={styles.tabIcon}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
