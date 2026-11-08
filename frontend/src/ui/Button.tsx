import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { fontSize, radius } from './tokens';

type Variant = 'primary' | 'secondary';
type Tone = 'default' | 'destructive' | 'positive';
type Size = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = filled with the tone colour, secondary = grey with tone-coloured text. */
  variant?: Variant;
  tone?: Tone;
  /** xs = several actions in a crowded row, sm = row actions, md = form buttons, lg = full-width calls to action. */
  size?: Size;
  /** Full width. */
  block?: boolean;
}

const SIZES: Record<Size, CSSProperties> = {
  xs: { padding: '6px 10px', borderRadius: radius.sm, fontSize: fontSize.sm },
  sm: { padding: '6px 12px', borderRadius: radius.sm, fontSize: fontSize.md },
  md: { padding: '12px', borderRadius: radius.md, fontSize: fontSize.lg },
  lg: { padding: '14px', borderRadius: radius.lg, fontSize: fontSize.lg },
};

const FILLED: Record<Tone, CSSProperties> = {
  default: { backgroundColor: 'var(--btn)', color: 'var(--btn-text)' },
  destructive: { backgroundColor: 'var(--destructive)', color: '#fff' },
  positive: { backgroundColor: 'var(--positive)', color: '#fff' },
};

const TONED_TEXT: Record<Tone, string> = {
  default: 'var(--text)',
  destructive: 'var(--destructive)',
  positive: 'var(--positive)',
};

export function Button({
  variant = 'primary',
  tone = 'default',
  size = 'md',
  block = false,
  type = 'button',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const colours =
    variant === 'primary'
      ? FILLED[tone]
      : { backgroundColor: 'var(--secondary-bg)', color: TONED_TEXT[tone] };

  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        fontWeight: 600,
        ...SIZES[size],
        ...colours,
        ...(block ? { display: 'block', width: '100%' } : {}),
        ...(disabled ? { opacity: 0.6, cursor: 'default' } : {}),
        ...style,
      }}
      {...rest}
    />
  );
}
