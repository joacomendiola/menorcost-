import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  variant?: 'auth' | 'auth-left' | 'profile';
}

export function PageShell({ children, variant = 'auth' }: PageShellProps) {
  const className =
    variant === 'profile'
      ? 'profile-wrap'
      : variant === 'auth-left'
        ? 'auth-wrap auth-wrap--left'
        : 'auth-wrap';

  return <main className={className}>{children}</main>;
}
