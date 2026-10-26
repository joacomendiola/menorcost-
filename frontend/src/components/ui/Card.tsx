import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  hover?: boolean;
}

export function Card({
  children,
  className = '',
  padding = 'md',
  radius = 'lg',
  shadow = 'md',
  border = true,
  hover = false,
}: CardProps) {
  return (
    <div
      className={`ui-card ui-card--padding-${padding} ui-card--radius-${radius} ui-card--shadow-${shadow} ${border ? 'ui-card--border' : ''} ${hover ? 'ui-card--hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
}