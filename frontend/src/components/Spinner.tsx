import { cn } from './cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Wird geladen …', className }: SpinnerProps) {
  const hasLabel = label.length > 0;

  return (
    <span
      className={cn('spinner', size !== 'md' && `spinner--${size}`, className)}
      role={hasLabel ? 'status' : undefined}
      aria-hidden={hasLabel ? undefined : true}
    >
      {hasLabel ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export type SkeletonVariant = 'text' | 'block' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ variant = 'text', width, height, className }: SkeletonProps) {
  return (
    <span
      className={cn('skeleton', variant !== 'block' && `skeleton--${variant}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cn('stack', 'gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant="text" width={index === lines - 1 ? '62%' : '100%'} />
      ))}
    </span>
  );
}
