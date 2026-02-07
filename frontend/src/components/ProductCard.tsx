import type { Product } from '../types';

const styles = {
  card: {
    backgroundColor: 'var(--bg)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: '8px',
    cursor: 'pointer',
    transition: 'transform 0.1s',
    WebkitTapHighlightColor: 'transparent',
  },
  emoji: {
    fontSize: '36px',
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
  },
  price: {
    fontSize: '13px',
    color: 'var(--hint)',
  },
};

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: Props) {
  return (
    <button
      style={styles.card}
      onClick={() => onSelect(product)}
      onTouchStart={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
      }}
      onTouchEnd={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
    >
      <span style={styles.emoji}>{product.emoji}</span>
      <span style={styles.name}>{product.name}</span>
      <span style={styles.price}>{product.price.toFixed(2)} €</span>
    </button>
  );
}
