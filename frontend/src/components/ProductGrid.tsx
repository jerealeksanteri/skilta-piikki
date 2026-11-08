import type { Product } from '../types';
import ProductCard from './ProductCard';
import { Section } from '../ui';

const styles = {
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
    <Section title="Log a drink">
      <div style={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onSelect={onSelect} />
        ))}
      </div>
    </Section>
  );
}
