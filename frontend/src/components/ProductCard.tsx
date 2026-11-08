import type { Product } from '../types';

const styles = {
  wrapper: {
    position: 'relative' as const,
  },
  card: {
    width: '100%',
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
  star: {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    width: '36px',
    height: '36px',
    borderRadius: '18px',
    backgroundColor: 'transparent',
    fontSize: '20px',
    lineHeight: '36px',
    WebkitTapHighlightColor: 'transparent',
  },
};

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
  favourite?: boolean;
  /** Shows a star in the corner when given. */
  onToggleFavourite?: (product: Product) => void;
}

export default function ProductCard({ product, onSelect, favourite = false, onToggleFavourite }: Props) {
  return (
    <div style={styles.wrapper}>
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
      {onToggleFavourite && (
        <button
          type="button"
          style={{ ...styles.star, color: favourite ? 'var(--warning)' : 'var(--hint)' }}
          onClick={() => onToggleFavourite(product)}
          aria-pressed={favourite}
          aria-label={favourite ? `Unpin ${product.name}` : `Pin ${product.name} to favourites`}
        >
          {favourite ? '★' : '☆'}
        </button>
      )}
    </div>
  );
}
