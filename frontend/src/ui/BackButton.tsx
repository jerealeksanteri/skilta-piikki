import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { fontSize } from './tokens';

interface Props {
  to?: string;
  children?: ReactNode;
  /** No side padding, for pages whose content already has its own. */
  flush?: boolean;
  style?: CSSProperties;
}

export function BackButton({ to = '/admin', children = '← Back to Admin', flush = false, style }: Props) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      style={{
        fontSize: fontSize.base,
        color: 'var(--link)',
        backgroundColor: 'transparent',
        padding: flush ? '8px 0' : '8px 16px',
        marginBottom: '8px',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
