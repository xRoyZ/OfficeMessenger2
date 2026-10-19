import type { ReactNode } from 'react';
import type { ChatKind } from '../lib/types';
import { Avatar } from './Avatar';
import { UnreadBadge } from './Badge';
import { cn } from './cn';
import { RouterItem } from './RouterItem';

export interface ChatRowProps {
  title: string;
  preview?: ReactNode;
  time?: string;
  avatarSrc?: string | null;
  unreadCount?: number;
  kind: ChatKind;
  isUnread?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function ChatRow({
  title,
  preview,
  time,
  avatarSrc,
  unreadCount = 0,
  kind,
  isUnread,
  to,
  onClick,
  className,
}: ChatRowProps) {
  const unread = isUnread ?? unreadCount > 0;
  const classes = cn('chat-row', unread && 'is-unread', className);
  const body = (
    <>
      <Avatar src={avatarSrc} name={title} size="md" alt="" />
      <span className="chat-row__body">
        <span className="chat-row__top">
          <span className="chat-row__name">{title}</span>
          {time ? <span className="chat-row__time">{time}</span> : null}
        </span>
        {preview ? (
          <span className="chat-row__preview">
            <span>{preview}</span>
          </span>
        ) : null}
      </span>
      <span className="chat-row__meta">
        <UnreadBadge count={unreadCount} />
        <span className="chat-row__kind">{kind === 'group' ? 'Gruppe' : 'Direkt'}</span>
      </span>
    </>
  );

  if (to || onClick) {
    return (
      <RouterItem
        to={to}
        onClick={onClick}
        className={classes}
        actionClassName="chat-row--action"
      >
        {body}
      </RouterItem>
    );
  }

  return <div className={classes}>{body}</div>;
}
