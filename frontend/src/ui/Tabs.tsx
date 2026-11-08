import type { CSSProperties, ReactNode } from 'react';
import { fontSize, space } from './tokens';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: CSSProperties;
}

/** Underlined tabs that switch between views of one page. */
export function Tabs<T extends string>({ tabs, value, onChange, style }: Props<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: space.sm,
        marginBottom: space.lg,
        borderBottom: '1px solid var(--secondary-bg)',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            style={{
              padding: '8px 16px',
              fontSize: fontSize.base,
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: active ? 'var(--text)' : 'var(--hint)',
              borderBottom: `2px solid ${active ? 'var(--btn)' : 'transparent'}`,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
