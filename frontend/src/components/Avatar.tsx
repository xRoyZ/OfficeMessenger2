import { useState } from 'react';
import { cn } from './cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  alt?: string;
  className?: string;
}

export function initialsForName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return '?';
  }

  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('de-DE') || '?';
}

export function Avatar({ src, name, size = 'md', alt, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const accessibleName = alt ?? name;
  const decorative = accessibleName === '';

  if (showImage && src) {
    return (
      <img
        className={cn('avatar', `avatar--${size}`, className)}
        src={src}
        alt={accessibleName}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <span
      className={cn('avatar', `avatar--${size}`, 'avatar--initials', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : accessibleName}
    >
      {initialsForName(name)}
    </span>
  );
}
