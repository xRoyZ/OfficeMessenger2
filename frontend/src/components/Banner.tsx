import type { ReactNode } from 'react';
import { cn } from './cn';

export type BannerVariant = 'error' | 'success' | 'info' | 'warning';

export interface BannerProps {
  variant?: BannerVariant;
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}

function BannerIcon({ variant }: { variant: BannerVariant }) {
  if (variant === 'success') {
    return (
      <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      {variant === 'error' ? <path d="M12 8v5M12 16h.01" /> : <path d="M12 11v5M12 8h.01" />}
    </svg>
  );
}

export function Banner({ variant = 'info', children, className, role }: BannerProps) {
  const isFormMessage = variant === 'error' || variant === 'success';
  const classes = cn(
    ...(isFormMessage
      ? ['form-message', `form-message--${variant}`, 'is-visible']
      : ['inline-note', variant === 'info' ? 'inline-note--info' : '']),
    className,
  );

  return (
    <div
      className={classes}
      role={role ?? (variant === 'error' ? 'alert' : 'status')}
    >
      <BannerIcon variant={variant} />
      <span>{children}</span>
    </div>
  );
}
