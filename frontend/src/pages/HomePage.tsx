import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listProducts } from '../api/products';
import { getLeaderboard } from '../api/users';
import { getMyDebts } from '../api/fiscal';
import { createPurchase, getUndoablePurchases } from '../api/transactions';
import type { Product, FiscalDebt, Transaction } from '../types';
import BalanceDisplay from '../components/BalanceDisplay';
import ProductOverlay from '../components/ProductOverlay';
import FiscalDebtsList from '../components/FiscalDebtsList';
import PendingPurchases from '../components/PendingPurchases';
import { toUndoItems, type UndoItem } from '../utils/undoWindow';
import { Button, tokens, useToast } from '../ui';

const fab = {
  position: 'fixed' as const,
  bottom: tokens.aboveNav,
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
  zIndex: tokens.zIndex.nav,
};

export default function HomePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [debts, setDebts] = useState<FiscalDebt[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const showToast = useToast();
  const [rank, setRank] = useState<number | undefined>(undefined);
  const [totalUsers, setTotalUsers] = useState<number | undefined>(undefined);
  const [pending, setPending] = useState<UndoItem[]>([]);

  /** Add or replace one purchase in the undo list, newest first. */
  const upsertPending = useCallback((tx: Transaction) => {
    setPending((prev) => {
      const [item] = toUndoItems([tx], Date.now(), prev);
      const rest = prev.filter((p) => p.tx.id !== tx.id);
      return item ? [item, ...rest] : rest;
    });
  }, []);

  const updatePending = useCallback(
    (tx: Transaction) => {
      setPending((prev) => {
        const [item] = toUndoItems([tx], Date.now(), prev);
        return prev.flatMap((p) => (p.tx.id !== tx.id ? [p] : item ? [item] : []));
      });
      refreshUser();
    },
    [refreshUser],
  );

  const removePending = useCallback(
    (id: number) => {
      setPending((prev) => prev.filter((p) => p.tx.id !== id));
      refreshUser();
    },
    [refreshUser],
  );

  // The server is the source of truth: load the open purchases on start and
  // whenever the app comes back to the foreground (timers pause in the background).
  useEffect(() => {
    const sync = () =>
      getUndoablePurchases()
        .then((txs) => setPending((prev) => toUndoItems(txs, Date.now(), prev)))
        .catch(console.error);
    sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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
      const tx = await createPurchase(product.id, quantity);
      upsertPending(tx);
      await refreshUser();
      showToast(`${product.emoji} ${quantity > 1 ? `${quantity}x ` : ''}${product.name} logged!`, 2000);
      setShowOverlay(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to log purchase', 3000);
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

      <PendingPurchases items={pending} onUpdate={updatePending} onRemove={removePending} />

      <FiscalDebtsList debts={debts} onUpdate={fetchDebts} />

      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button size="lg" block onClick={() => navigate('/payment')}>
          💰 Log Payment
        </Button>
        <Button size="lg" block style={{ backgroundColor: '#9c27b0', color: '#fff' }} onClick={() => navigate('/slot-machine')}>
          🎰 Slot Machine
        </Button>
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
    </div>
  );
}
