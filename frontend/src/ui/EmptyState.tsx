import type { CSSProperties, ReactNode } from 'react';
import { fontSize, space } from './tokens';

/** Centred grey text for "nothing here yet" and similar messages. */
export function EmptyState({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hint)', fontSize: fontSize.base, ...style }}>
      {children}
    </div>
  );
}

/** The placeholder shown while a page loads its data. */
export function Loading({ children = 'Loading...' }: { children?: ReactNode }) {
  return <EmptyState style={{ padding: space.xxl }}>{children}</EmptyState>;
}
