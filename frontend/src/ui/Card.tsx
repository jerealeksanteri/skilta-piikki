import type { HTMLAttributes } from 'react';
import { radius, space } from './tokens';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding, for cards that hold a form or text rather than list rows. */
  padded?: boolean;
}

/** A white rounded surface on the grey page background. */
export function Card({ padded = false, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg)',
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...(padded ? { padding: space.lg } : {}),
        ...style,
      }}
      {...rest}
    />
  );
}

/** A hairline between list rows, indented from the left like iOS lists. */
export function Divider({ inset = 16 }: { inset?: number }) {
  return <div style={{ height: '1px', backgroundColor: 'var(--secondary-bg)', marginLeft: `${inset}px` }} />;
}
