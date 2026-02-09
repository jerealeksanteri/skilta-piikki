import { useState } from 'react';
import type { Product } from '../types';
import ProductGrid from './ProductGrid';

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    zIndex: 200,
  },
  sheet: {
    backgroundColor: 'var(--section-bg)',
    borderRadius: '16px 16px 0 0',
    width: '100%',
    maxHeight: '85vh',
    overflow: 'auto' as const,
    paddingBottom: 'env(safe-area-inset-bottom, 16px)',
  },
  handle: {
    width: '36px',
    height: '4px',
    backgroundColor: 'var(--hint)',
    borderRadius: '2px',
    margin: '8px auto 4px',
    opacity: 0.4,
  },
  confirmSection: {
    padding: '16px',
    textAlign: 'center' as const,
  },
  selectedEmoji: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  selectedName: {
    fontSize: '17px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  selectedPrice: {
    fontSize: '14px',
    color: 'var(--hint)',
    marginBottom: '16px',
  },
  quantityRow: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '16px',
    marginBottom: '16px',
  },
  quantityBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    fontSize: '20px',
    fontWeight: 700,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quantityValue: {
    fontSize: '24px',
    fontWeight: 700,
    minWidth: '40px',
    textAlign: 'center' as const,
  },
  total: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    padding: '0 16px',
  },
  backBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
  },
  confirmBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: 'var(--btn)',
    color: 'var(--btn-text)',
  },
};

interface Props {
  products: Product[];
  onConfirm: (product: Product, quantity: number) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ProductOverlay({ products, onConfirm, onClose, loading }: Props) {
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const handleSelect = (product: Product) => {
    setSelected(product);
    setQuantity(1);
  };

  const handleBack = () => {
    setSelected(null);
    setQuantity(1);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />
        {!selected ? (
          <ProductGrid products={products} onSelect={handleSelect} />
        ) : (
          <div style={styles.confirmSection}>
            <div style={styles.selectedEmoji}>{selected.emoji}</div>
            <div style={styles.selectedName}>{selected.name}</div>
            <div style={styles.selectedPrice}>{selected.price.toFixed(2)} € each</div>
            <div style={styles.quantityRow}>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                −
              </button>
              <span style={styles.quantityValue}>{quantity}</span>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
            <div style={styles.total}>
              Total: {(selected.price * quantity).toFixed(2)} €
            </div>
            <div style={styles.buttons}>
              <button style={styles.backBtn} onClick={handleBack} disabled={loading}>
                Back
              </button>
              <button
                style={styles.confirmBtn}
                onClick={() => onConfirm(selected, quantity)}
                disabled={loading}
              >
                {loading ? 'Logging...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
