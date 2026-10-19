import { useLayoutEffect, useRef } from 'react';
import { Avatar, Button, EmptyState, cn } from '../../components';
import { useAuthedBlobUrl } from '../../lib/assets';
import type { ChatMessage } from './useChatMessages';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  olderError: string | null;
  onLoadOlder: () => Promise<void>;
  onRetry: (localId: string) => void;
}

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return 'unknown';
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string): string {
  const date = parseDate(value);
  if (!date) {
    return '';
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(value) === dayKey(today.toISOString())) {
    return 'Heute';
  }
  if (dayKey(value) === dayKey(yesterday.toISOString())) {
    return 'Gestern';
  }
  return dateFormatter.format(date);
}

function formatTime(value: string): string {
  const date = parseDate(value);
  return date ? timeFormatter.format(date) : '';
}

interface MessageRowProps {
  message: ChatMessage;
  isOwn: boolean;
  onRetry: (localId: string) => void;
}

function MessageRow({ message, isOwn, onRetry }: MessageRowProps) {
  const avatarUrl = useAuthedBlobUrl(message.sender?.avatar_url ?? null);

  if (message.kind === 'system') {
    return <p className="system-note">{message.text}</p>;
  }

  const failed = message.delivery === 'failed';
  const sending = message.delivery === 'sending';
  const receiptLabel = message.is_read ? 'Gelesen' : 'Gesendet';

  return (
    <article
      className={cn(
        'message',
        isOwn && 'message--out',
        sending && 'message--sending',
        failed && 'message--failed',
      )}
    >
      {!isOwn && message.sender ? (
        <Avatar
          className="message__avatar"
          src={avatarUrl}
          name={message.sender.display_name}
          size="sm"
          alt=""
        />
      ) : null}
      <div className="message__content">
        {!isOwn && message.sender ? (
          <div className="message__sender">{message.sender.display_name}</div>
        ) : null}
        <div className="message__bubble">{message.text}</div>
        <div className="message__meta">
          <span>{formatTime(message.created_at)}</span>
          {isOwn ? (
            <span
              className={cn('receipt', message.is_read && 'receipt--read')}
              title={receiptLabel}
              aria-label={receiptLabel}
            >
              {message.is_read ? (
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 12 4 4L15 7" />
                  <path d="m10 16 1 1L22 6" />
                </svg>
              ) : (
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m4 12 5 5L20 6" />
                </svg>
              )}
            </span>
          ) : null}
        </div>
        {failed && message.localId ? (
          <button
            className="message__retry"
            type="button"
            onClick={() => onRetry(message.localId as string)}
          >
            <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            Erneut senden
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MessageList({
  messages,
  currentUserId,
  hasMore,
  loadingOlder,
  olderError,
  onLoadOlder,
  onRetry,
}: MessageListProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const previousCountRef = useRef(0);
  const pendingRestoreRef = useRef<{ height: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    const pendingRestore = pendingRestoreRef.current;
    if (pendingRestore) {
      pendingRestoreRef.current = null;
      thread.scrollTop = pendingRestore.top + (thread.scrollHeight - pendingRestore.height);
    } else if (previousCountRef.current === 0 || atBottomRef.current) {
      thread.scrollTop = thread.scrollHeight;
    }

    previousCountRef.current = messages.length;
  }, [messages]);

  const loadOlder = async () => {
    if (!hasMore || loadingOlder) {
      return;
    }

    const thread = threadRef.current;
    if (thread) {
      pendingRestoreRef.current = { height: thread.scrollHeight, top: thread.scrollTop };
    }

    await onLoadOlder();
  };

  const handleScroll = () => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    atBottomRef.current = distance < 80;

    if (thread.scrollTop <= 32) {
      void loadOlder();
    }
  };

  const groups: { key: string; label: string; entries: ChatMessage[] }[] = [];
  for (const message of messages) {
    const key = dayKey(message.created_at);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.entries.push(message);
    } else {
      groups.push({ key, label: dayLabel(message.created_at), entries: [message] });
    }
  }

  return (
    <div
      className="thread"
      ref={threadRef}
      onScroll={handleScroll}
      aria-live="polite"
      data-testid="message-thread"
    >
      {hasMore ? (
        <div className="thread__loader">
          <Button variant="ghost" size="sm" onClick={() => void loadOlder()} loading={loadingOlder}>
            <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
            Ältere Nachrichten laden
          </Button>
        </div>
      ) : null}

      {olderError ? <p className="thread__error">{olderError}</p> : null}

      {messages.length === 0 ? (
        <EmptyState title="Noch keine Nachrichten" />
      ) : (
        groups.map((group) => (
          <div className="thread__group" key={group.key}>
            <div className="day-divider">
              <span>{group.label}</span>
            </div>
            {group.entries.map((message) => (
              <MessageRow
                key={message.localId ?? message.id}
                message={message}
                isOwn={Boolean(currentUserId) && message.sender?.id === currentUserId}
                onRetry={onRetry}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
