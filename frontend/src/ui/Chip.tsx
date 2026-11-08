import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { fontSize, radius } from './tokens';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** A small rounded toggle, for presets and filters. */
export function Chip({ selected = false, style, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      style={{
        padding: '6px 10px',
        borderRadius: radius.chip,
        fontSize: fontSize.md,
        fontWeight: 500,
        backgroundColor: selected ? 'var(--btn)' : 'var(--secondary-bg)',
        color: selected ? 'var(--btn-text)' : 'var(--text)',
        ...style,
      }}
      {...rest}
    />
  );
}

/** Small coloured label inside a row, such as "Admin" or "Pending". */
export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'muted' }) {
  return (
    <span
      style={{
        fontSize: fontSize.xs,
        padding: '2px 6px',
        borderRadius: radius.xs,
        fontWeight: 600,
        backgroundColor: tone === 'accent' ? 'var(--btn)' : 'var(--secondary-bg)',
        color: tone === 'accent' ? 'var(--btn-text)' : 'var(--hint)',
      }}
    >
      {children}
    </span>
  );
}
