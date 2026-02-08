import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { listProducts } from '../api/products';
import { createPurchase } from '../api/transactions';
import type { Product } from '../types';
import BalanceDisplay from '../components/BalanceDisplay';
import ProductGrid from '../components/ProductGrid';
import ConfirmDialog from '../components/ConfirmDialog';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    listProducts().then(setProducts).catch(console.error);
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    try {
      await createPurchase(selected.id);
      await refreshUser();
      setToast(`${selected.emoji} ${selected.name} logged!`);
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to log purchase');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPurchasing(false);
      setSelected(null);
    }
  };

  return (
    <div>
      <BalanceDisplay balance={user?.balance ?? 0} />
      <ProductGrid products={products} onSelect={setSelected} />

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
            backgroundColor: 'var(--secondary-bg)',
            color: 'var(--text)',
          }}
        >
          💰 Log Payment
        </button>
      </div>

      {selected && (
        <ConfirmDialog
          emoji={selected.emoji}
          title={`Log ${selected.name}?`}
          subtitle={`${selected.price.toFixed(2)} € will be deducted from your balance`}
          onConfirm={handlePurchase}
          onCancel={() => setSelected(null)}
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
