import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getMe } from './api/users';
import type { User } from './types';
import { UserContext } from './context/UserContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import AdminPaymentPage from './pages/AdminPaymentPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminFiscalPage from './pages/AdminFiscalPage';
import AdminMessagesPage from './pages/AdminMessagesPage';
import AdminRewardsPage from './pages/AdminRewardsPage';
import AdminSlotMachinePage from './pages/AdminSlotMachinePage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminNewsletterPage from './pages/AdminNewsletterPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PaymentRequestPage from './pages/PaymentRequestPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import SlotMachinePage from './pages/SlotMachinePage';

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
    getMe()
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load user'))
      .finally(() => setLoading(false));
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

  if (user && !user.is_active) {
    return <PendingApprovalPage />;
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
            <Route path="/slot-machine" element={<SlotMachinePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/payment" element={<AdminPaymentPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/fiscal" element={<AdminFiscalPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
            <Route path="/admin/rewards" element={<AdminRewardsPage />} />
            <Route path="/admin/slot-machine" element={<AdminSlotMachinePage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/newsletter" element={<AdminNewsletterPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </UserContext.Provider>
  );
}
