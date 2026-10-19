import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  count?: number;
  children: ReactNode;
}

export function FilterChip({
  selected = false,
  count,
  className,
  children,
  type = 'button',
  ...buttonProps
}: FilterChipProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={cn('filter-chip', selected && 'is-active', className)}
      aria-pressed={selected}
    >
      {children}
      {typeof count === 'number' ? <span className="filter-chip__count">{count}</span> : null}
    </button>
  );
}

export const Tab = FilterChip;
