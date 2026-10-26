import type { ReactNode } from 'react';

export type BadgeTone = 'ok' | 'pend' | 'blue' | 'bad' | 'neutro';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ children, tone = 'neutro', dot = true }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}