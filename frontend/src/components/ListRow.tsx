import type { ReactNode } from 'react';
import { cn } from './cn';
import { RouterItem } from './RouterItem';

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  to,
  onClick,
  selected = false,
  disabled = false,
  className,
  ariaLabel,
}: ListRowProps) {
  const classes = cn(
    'contact-row',
    selected && 'is-selected',
    disabled && 'is-disabled',
    className,
  );
  const body = (
    <>
      {leading}
      <span className="contact-row__body">
        <span className="contact-row__name">{title}</span>
        {subtitle ? <span className="contact-row__info">{subtitle}</span> : null}
      </span>
      {trailing}
    </>
  );

  if (disabled) {
    return (
      <div className={classes} aria-disabled="true" aria-label={ariaLabel}>
        {body}
      </div>
    );
  }

  if (to || onClick) {
    return (
      <RouterItem
        to={to}
        onClick={onClick}
        className={classes}
        actionClassName={cn('contact-row--action', selected && 'is-selected')}
        ariaLabel={ariaLabel}
      >
        {body}
      </RouterItem>
    );
  }

  return (
    <div className={classes} aria-label={ariaLabel}>
      {body}
    </div>
  );
}
