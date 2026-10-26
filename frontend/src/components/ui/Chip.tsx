import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  dark?: boolean;        // para tabs admin (fondo #0F172A)
  danger?: boolean;      // texto rojo
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  current?: boolean;
}

export function Chip({
  children,
  active = false,
  dark = false,
  danger = false,
  onClick,
  className = '',
  disabled = false,
  current = false,
}: ChipProps) {
  const variants = {
    default: 'ui-chip--default',
    active: 'ui-chip--active',
    dark: 'ui-chip--dark',
    danger: 'ui-chip--danger',
  };

  let variantClass = variants.default;
  if (active && dark) variantClass = variants.dark;
  else if (active) variantClass = variants.active;
  else if (danger) variantClass = variants.danger;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      className={`ui-chip ${variantClass} ${disabled ? 'ui-chip--disabled' : ''} ${className}`}
    >
      {children}
    </button>
  );
}