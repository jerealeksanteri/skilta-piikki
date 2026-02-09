import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { listProducts } from '../api/products';
import { getLeaderboard } from '../api/users';
import { getMyDebts } from '../api/fiscal';
import { createPurchase } from '../api/transactions';
import type { Product, FiscalDebt } from '../types';
import BalanceDisplay from '../components/BalanceDisplay';
import ProductOverlay from '../components/ProductOverlay';
import FiscalDebtsList from '../components/FiscalDebtsList';

const fab = {
  position: 'fixed' as const,
  bottom: '80px',
  right: '20px',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: 'var(--btn)',
  color: 'var(--btn-text)',
  fontSize: '32px',
  fontWeight: 700,
  lineHeight: '64px',
  textAlign: 'center' as const,
  display: 'flex',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  zIndex: 100,
};

export default function HomePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [debts, setDebts] = useState<FiscalDebt[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rank, setRank] = useState<number | undefined>(undefined);
  const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);

  const fetchDebts = () => {
    getMyDebts().then(setDebts).catch(console.error);
  };

  useEffect(() => {
    listProducts().then(setProducts).catch(console.error);
    fetchDebts();
    getLeaderboard()
      .then((lb) => {
        setTotalUsers(lb.length);
        const idx = lb.findIndex((u) => u.id === user?.id);
        if (idx !== -1) setRank(idx + 1);
      })
      .catch(console.error);
  }, []);

  const handlePurchase = async (product: Product, quantity: number) => {
    setPurchasing(true);
    try {
      await createPurchase(product.id, quantity);
      await refreshUser();
      setToast(`${product.emoji} ${quantity > 1 ? `${quantity}x ` : ''}${product.name} logged!`);
      setTimeout(() => setToast(null), 2000);
      setShowOverlay(false);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to log purchase');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div>
      <BalanceDisplay
        balance={user?.total_balance ?? 0}
        fiscalDebtTotal={user?.fiscal_debt_total}
        rank={rank}
        totalUsers={totalUsers}
      />

      <FiscalDebtsList debts={debts} onUpdate={fetchDebts} />

      <div style={{ padding: '8px 16px 0' }}>
        <button
          onClick={() => navigate('/payment')}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            backgroundColor: 'var(--btn)',
            color: 'var(--btn-text)',
          }}
        >
          💰 Log Payment
        </button>
      </div>

      <button style={fab} onClick={() => setShowOverlay(true)}>
        +
      </button>

      {showOverlay && (
        <ProductOverlay
          products={products}
          onConfirm={handlePurchase}
          onClose={() => setShowOverlay(false)}
          loading={purchasing}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
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
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
