import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Banner,
  ChatRow,
  EmptyState,
  FilterChip,
  ListRow,
  RouterItem,
  SearchField,
  Skeleton,
  buttonClassName,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { StatusStrip } from '../features/status/StatusStrip';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import { useAuthedBlobUrl } from '../lib/assets';
import { subscribe } from '../lib/realtime';
import type { ChatOut, UserOut, WsEvent } from '../lib/types';

type ChatFilter = 'all' | 'unread' | 'groups' | 'direct';

const FILTERS: Array<{ id: ChatFilter; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'unread', label: 'Ungelesen' },
  { id: 'groups', label: 'Gruppen' },
  { id: 'direct', label: 'Direkt' },
];

function chatsPath(filter: ChatFilter, search: string): string {
  const params = new URLSearchParams({ filter });
  const term = search.trim();
  if (term) {
    params.set('search', term);
  }
  return `/api/chats?${params.toString()}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatChatTime(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) {
    return 'Gestern';
  }
  if (days < 7) {
    return date.toLocaleDateString('de-DE', { weekday: 'short' }).replace(/\.$/, '');
  }
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function previewFor(chat: ChatOut): string {
  const last = chat.last_message;
  if (!last) {
    return '';
  }
  if (chat.kind === 'group' && last.sender_display_name) {
    const firstName = last.sender_display_name.trim().split(/\s+/)[0];
    return `${firstName}: ${last.text}`;
  }
  return last.text;
}

function sumUnread(chats: ChatOut[]): number {
  return chats.reduce((total, chat) => total + chat.unread_count, 0);
}

interface ChatEntryProps {
  chat: ChatOut;
}

function ChatEntry({ chat }: ChatEntryProps) {
  const photoUrl = useAuthedBlobUrl(chat.photo_url);

  return (
    <ChatRow
      to={`/chats/${chat.id}`}
      title={chat.title}
      preview={previewFor(chat) || undefined}
      time={formatChatTime(chat.last_message?.created_at ?? chat.last_activity_at)}
      avatarSrc={photoUrl}
      unreadCount={chat.unread_count}
      kind={chat.kind}
    />
  );
}

function ChevronIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface ContactResultProps {
  contact: UserOut;
  busy: boolean;
  onOpen: (contact: UserOut) => void;
}

function ContactResult({ contact, busy, onOpen }: ContactResultProps) {
  const avatarUrl = useAuthedBlobUrl(contact.avatar_url);

  return (
    <ListRow
      title={contact.display_name}
      subtitle={contact.status_text ?? undefined}
      leading={<Avatar src={avatarUrl} name={contact.display_name} size="sm" alt="" />}
      trailing={<ChevronIcon />}
      disabled={busy}
      ariaLabel={`Chat mit ${contact.display_name} öffnen`}
      onClick={() => onOpen(contact)}
    />
  );
}

function LoadingRows() {
  return (
    <div className="chat-list" aria-label="Chatliste wird geladen">
      {[0, 1, 2, 3].map((index) => (
        <div className="chat-row" key={index} aria-hidden="true">
          <Skeleton variant="circle" width={44} height={44} />
          <span className="chat-row__body">
            <span className="chat-row__top">
              <Skeleton variant="text" width="42%" />
              <Skeleton variant="text" width={38} />
            </span>
            <Skeleton variant="text" width="68%" />
          </span>
          <span className="chat-row__meta">
            <Skeleton variant="text" width={26} />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ChatListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<ChatOut[]>([]);
  const [allChats, setAllChats] = useState<ChatOut[]>([]);
  const [contacts, setContacts] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get<ChatOut[]>(chatsPath(filter, search))
      .then((result) => {
        if (active) {
          setChats(result);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        setChats([]);
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Die Chats konnten nicht geladen werden.',
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filter, search, refreshToken]);

  useEffect(() => {
    let active = true;

    api
      .get<ChatOut[]>('/api/chats?filter=all')
      .then((result) => {
        if (active) {
          setAllChats(result);
        }
      })
      .catch(() => {
        if (active) {
          setAllChats([]);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setContacts([]);
      return;
    }

    let active = true;
    api
      .get<UserOut[]>(`/api/users?search=${encodeURIComponent(term)}`)
      .then((result) => {
        if (active) {
          setContacts(result);
        }
      })
      .catch(() => {
        if (active) {
          setContacts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [search]);

  useEffect(() => {
    return subscribe((event: WsEvent) => {
      if (event.type === 'message:new' || event.type === 'chat:updated') {
        setRefreshToken((token) => token + 1);
      }
    });
  }, []);

  const openContact = useCallback(
    async (contact: UserOut) => {
      setOpeningUserId(contact.id);
      try {
        const chat = await api.post<ChatOut>('/api/chats/direct', { user_id: contact.id });
        navigate(`/chats/${chat.id}`);
      } catch (caught: unknown) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Der Chat konnte nicht geöffnet werden.',
        );
      } finally {
        setOpeningUserId(null);
      }
    },
    [navigate],
  );

  const openStatus = useCallback(
    (statusId: string) => {
      navigate(`/status/${statusId}`);
    },
    [navigate],
  );

  const totalUnread = sumUnread(allChats);
  const counts: Record<ChatFilter, number> = {
    all: allChats.length,
    unread: allChats.filter((chat) => chat.unread_count > 0).length,
    groups: allChats.filter((chat) => chat.kind === 'group').length,
    direct: allChats.filter((chat) => chat.kind === 'direct').length,
  };
  const showEmpty = !loading && chats.length === 0 && contacts.length === 0;

  return (
    <AppShell>
      <header className="page-header" data-od-id="chats-header">
        <div className="page-header__copy">
          <div className="eyebrow">
            {user ? `Postfach · ${user.display_name}` : 'Postfach'}
          </div>
          <div className="page-title">
            <h1>Chats</h1>
            <span className="count" aria-label={`${totalUnread} ungelesene Nachrichten`}>
              {totalUnread}
            </span>
          </div>
          <p className="page-subtitle">
            Alles, was heute im Team passiert — und die Bilder, die den Tag festhalten.
          </p>
        </div>
        <div className="page-actions">
          <RouterItem
            to="/gruppen/neu"
            className={buttonClassName({ variant: 'primary' })}
            ariaLabel="Neue Gruppe"
          >
            <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Neue Gruppe
          </RouterItem>
        </div>
      </header>

      <StatusStrip onOpen={openStatus} />

      <section
        className="inbox-toolbar stack gap-3"
        aria-label="Chats filtern"
        data-od-id="chat-toolbar"
        style={{ margin: '20px 0 12px' }}
      >
        <SearchField
          label="Chats und Kontakte suchen"
          placeholder="Chats und Kontakte suchen …"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="filter-bar" role="group" aria-label="Chats nach Art filtern">
          {FILTERS.map((entry) => (
            <FilterChip
              key={entry.id}
              selected={filter === entry.id}
              count={counts[entry.id]}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </FilterChip>
          ))}
        </div>
      </section>

      <section
        className="inbox-list card"
        id="chat-list"
        aria-label="Chatliste"
        data-od-id="chat-list"
        style={{ overflow: 'hidden' }}
      >
        {error ? <Banner variant="error">{error}</Banner> : null}
        {loading ? (
          <LoadingRows />
        ) : (
          <div className="chat-list">
            {chats.map((chat) => (
              <ChatEntry key={chat.id} chat={chat} />
            ))}
          </div>
        )}
        {showEmpty ? (
          <EmptyState
            title="Nichts gefunden"
            description="Kein Chat und keine Kontaktperson passt zu deiner Suche."
          />
        ) : null}
      </section>

      {contacts.length > 0 ? (
        <section
          className="search-results card"
          id="contact-results"
          aria-label="Gefundene Kontakte"
          style={{ marginTop: 14, overflow: 'hidden' }}
        >
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              padding: '11px 17px',
              borderBottom: '1px solid var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <span className="eyebrow">Kontakte</span>
            <span className="eyebrow">Chat öffnen</span>
          </div>
          {contacts.map((contact) => (
            <ContactResult
              key={contact.id}
              contact={contact}
              busy={openingUserId === contact.id}
              onOpen={openContact}
            />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
