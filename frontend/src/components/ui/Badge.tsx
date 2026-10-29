import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'brand' | 'success' };
export function Badge({ tone = 'neutral', className = '', ...props }: Props) {
  return <span className={`badge badge--${tone} ${className}`} {...props} />;
}
