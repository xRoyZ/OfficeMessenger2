import type { ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { cn } from './cn';

export interface RouterItemProps {
  to?: string;
  onClick?: () => void;
  className?: string;
  actionClassName?: string;
  children: ReactNode;
  ariaLabel?: string;
}

export function RouterItem({
  to,
  onClick,
  className,
  actionClassName,
  children,
  ariaLabel,
}: RouterItemProps) {
  const inRouter = useInRouterContext();

  if (to && inRouter) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel} onClick={onClick}>
        {children}
      </Link>
    );
  }

  if (to) {
    return (
      <a href={to} className={className} aria-label={ariaLabel} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cn(className, actionClassName)}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
