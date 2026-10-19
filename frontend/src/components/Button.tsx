import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'accent' | 'soft' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function buttonClassName({
  variant = 'outline',
  size = 'md',
  block = false,
  iconOnly = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'btn',
    `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    size === 'lg' && 'btn--lg',
    iconOnly && 'btn--icon',
    block && 'btn--block',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'outline',
  size = 'md',
  loading = false,
  block = false,
  iconOnly = false,
  className,
  children,
  disabled,
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={buttonClassName({ variant, size, block, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size="sm" label="" /> : null}
      {loading && iconOnly ? null : children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'iconOnly' | 'block'> {
  label: string;
}

export function IconButton({ label, children, title, ...buttonProps }: IconButtonProps) {
  return (
    <Button {...buttonProps} iconOnly aria-label={label} title={title ?? label}>
      {children}
    </Button>
  );
}
