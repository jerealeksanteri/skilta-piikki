import type { Product } from '../types';
import ProductCard from './ProductCard';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
};

interface Props {
  products: Product[];
  onSelect: (product: Product) => void;
}

export default function ProductGrid({ products, onSelect }: Props) {
  return (
    <div style={styles.section}>
      <div style={styles.header}>Log a drink</div>
      <div style={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
