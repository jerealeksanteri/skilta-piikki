import type { Product } from '../types';
import ProductCard from './ProductCard';
import { Section } from '../ui';

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  hint: {
    fontSize: '13px',
    color: 'var(--hint)',
  },
};

interface Props {
  products: Product[];
  onSelect: (product: Product) => void;
  /** With these, the grid shows a Favourites section and a star on every card. */
  favouriteIds?: number[];
  onToggleFavourite?: (product: Product) => void;
}

export default function ProductGrid({ products, onSelect, favouriteIds, onToggleFavourite }: Props) {
  const isFavourite = (p: Product) => favouriteIds?.includes(p.id) ?? false;
  // Same order as the full menu below.
  const favourites = products.filter(isFavourite);

  const grid = (items: Product[]) => (
    <div style={styles.grid}>
      {items.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onSelect={onSelect}
          favourite={isFavourite(p)}
          onToggleFavourite={onToggleFavourite}
        />
      ))}
    </div>
  );

  return (
    <>
      {favouriteIds && (
        <Section title="Favourites">
          {favourites.length > 0 ? grid(favourites) : <div style={styles.hint}>Star a drink to pin it here</div>}
        </Section>
      )}
      <Section title="Log a drink">{grid(products)}</Section>
    </>
  );
}
