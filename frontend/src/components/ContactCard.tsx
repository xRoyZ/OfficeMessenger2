import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { cn } from './cn';
import { RouterItem } from './RouterItem';

export interface ContactCardProps {
  name: string;
  info?: ReactNode;
  avatarSrc?: string | null;
  to?: string;
  onClick?: () => void;
  className?: string;
}

function ChevronIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ContactCard({
  name,
  info,
  avatarSrc,
  to,
  onClick,
  className,
}: ContactCardProps) {
  const classes = cn('contact-card', className);
  const body = (
    <>
      <Avatar src={avatarSrc} name={name} size="md" alt="" />
      <span className="contact-card__body">
        <span className="contact-card__name">{name}</span>
        {info ? <span className="contact-card__info">{info}</span> : null}
      </span>
      <span className="contact-card__arrow">
        <ChevronIcon />
      </span>
    </>
  );

  if (to || onClick) {
    return (
      <RouterItem
        to={to}
        onClick={onClick}
        className={classes}
        actionClassName="contact-card--action"
      >
        {body}
      </RouterItem>
    );
  }

  return <div className={classes}>{body}</div>;
}
