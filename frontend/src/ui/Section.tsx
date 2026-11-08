import type { CSSProperties, ReactNode } from 'react';
import { fontSize, space } from './tokens';

type HeaderTone = 'default' | 'destructive' | 'warning';

const HEADER_COLOURS: Record<HeaderTone, string> = {
  default: 'var(--section-header)',
  destructive: 'var(--destructive)',
  warning: 'var(--warning)',
};

interface HeaderProps {
  children: ReactNode;
  tone?: HeaderTone;
  style?: CSSProperties;
}

/** The small uppercase title above a group of content. */
export function SectionHeader({ children, tone = 'default', style }: HeaderProps) {
  return (
    <div
      style={{
        fontSize: fontSize.md,
        fontWeight: 600,
        color: HEADER_COLOURS[tone],
        textTransform: 'uppercase',
        padding: `${space.lg} 0 ${space.sm}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface SectionProps {
  title?: ReactNode;
  titleTone?: HeaderTone;
  children?: ReactNode;
  style?: CSSProperties;
}

/** A page block with side padding and an optional header. */
export function Section({ title, titleTone, children, style }: SectionProps) {
  return (
    <div style={{ padding: `0 ${space.lg} ${space.lg}`, ...style }}>
      {title !== undefined && <SectionHeader tone={titleTone}>{title}</SectionHeader>}
      {children}
    </div>
  );
}
