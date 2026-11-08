import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { fontSize, radius, space } from './tokens';

type FieldSize = 'md' | 'sm';

function fieldStyle(size: FieldSize): CSSProperties {
  return {
    width: '100%',
    padding: size === 'sm' ? space.sm : space.md,
    borderRadius: radius.md,
    border: '1px solid var(--secondary-bg)',
    backgroundColor: 'var(--secondary-bg)',
    color: 'var(--text)',
    fontSize: fontSize.lg,
    outline: 'none',
  };
}

interface LabelProps {
  label?: ReactNode;
  hint?: ReactNode;
}

/** Wraps a control with a label above and a hint below; renders it bare when neither is given. */
function Labelled({ label, hint, children }: LabelProps & { children: ReactNode }) {
  if (label === undefined && hint === undefined) return <>{children}</>;
  return (
    <label style={{ display: 'block' }}>
      {label !== undefined && (
        <div style={{ fontSize: fontSize.md, color: 'var(--hint)', marginBottom: space.xs }}>{label}</div>
      )}
      {children}
      {hint !== undefined && hint !== '' && (
        <div style={{ fontSize: fontSize.sm, color: 'var(--hint)', marginTop: space.xs }}>{hint}</div>
      )}
    </label>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, LabelProps {
  /** sm = tighter padding, for inputs inside a list row. */
  size?: FieldSize;
}

export function TextField({ label, hint, size = 'md', style, ...rest }: TextFieldProps) {
  return (
    <Labelled label={label} hint={hint}>
      <input style={{ ...fieldStyle(size), ...style }} {...rest} />
    </Labelled>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, LabelProps {
  size?: FieldSize;
}

export function Select({ label, hint, size = 'md', style, children, ...rest }: SelectProps) {
  return (
    <Labelled label={label} hint={hint}>
      <select
        style={{
          ...fieldStyle(size),
          ...(rest.multiple ? {} : { appearance: 'none', WebkitAppearance: 'none' }),
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    </Labelled>
  );
}

interface DateTimeFieldProps extends Omit<TextFieldProps, 'type'> {
  type?: 'date' | 'time' | 'datetime-local';
}

/**
 * A date, time or date-and-time input. It fits its container on iOS thanks
 * to the date-input rules in styles/global.css (WebKit sizes native date
 * controls by their value otherwise); use this instead of a bare input.
 */
export function DateTimeField({ type = 'datetime-local', ...rest }: DateTimeFieldProps) {
  return <TextField type={type} {...rest} />;
}
