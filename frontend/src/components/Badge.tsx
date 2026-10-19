import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'neutral' | 'accent' | 'warning' | 'danger' | 'outline' | 'solid';

export interface BadgeProps {
  variant?: BadgeVariant;
  count?: number;
  max?: number;
  className?: string;
  children?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  count,
  max,
  className,
  children,
}: BadgeProps) {
  if (typeof count === 'number') {
    return <UnreadBadge count={count} max={max} className={className} />;
  }

  return (
    <span className={cn('badge', variant !== 'neutral' && `badge--${variant}`, className)}>
      {children}
    </span>
  );
}

export interface UnreadBadgeProps {
  count: number;
  max?: number;
  className?: string;
  label?: string;
}

export function UnreadBadge({ count, max = 99, className, label }: UnreadBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const text = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cn('count', className)}
      aria-label={label ?? `${count} ungelesene Nachrichten`}
    >
      {text}
    </span>
  );
}

export const CountBadge = UnreadBadge;
