import { Link, useParams } from 'react-router-dom';
import { Avatar, Badge, Banner, Spinner } from '../components';
import { useAuth } from '../context/AuthContext';
import { MessageComposer } from '../features/chat/MessageComposer';
import { MessageList } from '../features/chat/MessageList';
import { useChatMessages } from '../features/chat/useChatMessages';
import { AppShell } from '../layout/AppShell';
import { useAuthedBlobUrl } from '../lib/assets';
import type { ChatOut } from '../lib/types';
import '../features/chat/chat.css';

function groupSubtitle(chat: ChatOut): string {
  const label = chat.member_count === 1 ? 'Mitglied' : 'Mitglieder';
  const names = chat.members.map((member) => member.user.display_name).join(', ');
  return `${chat.member_count} ${label}${names ? ` · ${names}` : ''}`;
}

function BackIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const {
    chat,
    messages,
    hasMore,
    status,
    error,
    olderError,
    loadingOlder,
    loadOlder,
    send,
    retry,
  } = useChatMessages(chatId);
  const photoUrl = useAuthedBlobUrl(chat?.photo_url ?? null);

  const isGroup = chat?.kind === 'group';
  const title = chat?.title ?? 'Chat';
  const frameLabel = chat
    ? isGroup
      ? `Gruppenchat ${chat.title}`
      : `Unterhaltung mit ${chat.title}`
    : 'Chat';

  return (
    <AppShell>
      <div className="chat-page">
        <section className="chat-frame" aria-label={frameLabel}>
          <header className="chat-head">
            <Link className="btn btn--icon btn--sm btn--ghost" to="/chats" aria-label="Zurück zu den Chats">
              <BackIcon />
            </Link>
            <Avatar src={photoUrl} name={title} size="md" alt={title} />
            <div className="chat-head__body">
              <div className="chat-head__title">
                <span>{title}</span>
                <Badge>{isGroup ? 'Gruppe' : 'Direkt'}</Badge>
              </div>
              {isGroup && chat ? <div className="chat-head__sub">{groupSubtitle(chat)}</div> : null}
            </div>
            <div className="chat-head__actions">
              {isGroup && chat ? (
                <Link
                  className="btn btn--sm btn--outline"
                  to={`/gruppen/${chat.id}/einstellungen`}
                >
                  <InfoIcon />
                  Gruppeninfo
                </Link>
              ) : (
                <Link className="btn btn--sm btn--ghost" to="/kontakte">
                  Kontakte
                </Link>
              )}
            </div>
          </header>

          {status === 'loading' ? (
            <div className="thread thread--status">
              <Spinner />
            </div>
          ) : status === 'error' ? (
            <div className="thread thread--status">
              <Banner variant="error">{error ?? 'Der Chat konnte nicht geladen werden.'}</Banner>
              <Link className="btn btn--sm btn--ghost" to="/chats">
                Zurück zu den Chats
              </Link>
            </div>
          ) : (
            <MessageList
              messages={messages}
              currentUserId={user?.id ?? null}
              hasMore={hasMore}
              loadingOlder={loadingOlder}
              olderError={olderError}
              onLoadOlder={loadOlder}
              onRetry={retry}
            />
          )}

          {chat && status === 'ready' ? (
            <MessageComposer
              kind={chat.kind}
              title={chat.title}
              memberCount={chat.member_count}
              onSend={send}
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
