import { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getMe } from './api/users';
import type { User } from './types';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import AdminPaymentPage from './pages/AdminPaymentPage';
import AdminUsersPage from './pages/AdminUsersPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PaymentRequestPage from './pages/PaymentRequestPage';

interface UserContextType {
  user: User | null;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  refreshUser: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user');
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--hint)', fontSize: '16px' }}>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
        <span style={{ color: 'var(--destructive)', fontSize: '14px' }}>{error}</span>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, refreshUser }}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/ranking" element={<LeaderboardPage />} />
            <Route path="/payment" element={<PaymentRequestPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/payment" element={<AdminPaymentPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </UserContext.Provider>
  );
}
