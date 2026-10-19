import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Banner,
  ContactCard,
  EmptyState,
  SearchField,
  Spinner,
} from '../components';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import { useAuthedBlobUrl } from '../lib/assets';
import type { ChatOut, UserOut } from '../lib/types';

const SEARCH_DEBOUNCE_MS = 250;
const FALLBACK_ERROR = 'Die Anfrage ist fehlgeschlagen.';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : FALLBACK_ERROR;
}

interface ContactEntryProps {
  user: UserOut;
  pending: boolean;
  onSelect: (user: UserOut) => void;
}

function ContactEntry({ user, pending, onSelect }: ContactEntryProps) {
  const avatarUrl = useAuthedBlobUrl(user.avatar_url);

  return (
    <ContactCard
      name={user.display_name}
      info={pending ? <Spinner size="sm" label="" /> : (user.status_text ?? undefined)}
      avatarSrc={avatarUrl}
      onClick={() => onSelect(user)}
    />
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const term = search.trim();
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    let active = true;

    const load = () => {
      setLoading(true);
      setError(null);

      const path = term ? `/api/users?search=${encodeURIComponent(term)}` : '/api/users';

      api
        .get<UserOut[]>(path)
        .then((result) => {
          if (!active || requestId.current !== currentRequest) {
            return;
          }
          setUsers(result);
          setLoading(false);
        })
        .catch((cause: unknown) => {
          if (!active || requestId.current !== currentRequest) {
            return;
          }
          setUsers([]);
          setError(errorMessage(cause));
          setLoading(false);
        });
    };

    const timer = window.setTimeout(load, term ? SEARCH_DEBOUNCE_MS : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const openChat = async (user: UserOut) => {
    if (pendingUserId) {
      return;
    }

    setPendingUserId(user.id);
    setError(null);

    try {
      const chat = await api.post<ChatOut>('/api/chats/direct', { user_id: user.id });
      navigate(`/chats/${chat.id}`);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setPendingUserId(null);
    }
  };

  const term = search.trim();

  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Menschen im Messenger</div>
          <h1>Kontakte</h1>
          <p className="page-subtitle">
            Alle Kolleg:innen auf einen Blick. Tippe auf eine Person, um den 1:1-Chat zu öffnen.
          </p>
        </div>
        <div className="page-actions">
          <Badge variant="outline">
            {term ? `${users.length} Treffer` : `${users.length} Kolleg:innen`}
          </Badge>
        </div>
      </header>

      <div className="inbox-toolbar" style={{ marginTop: 0 }}>
        <SearchField
          label="Kontakte nach Namen durchsuchen"
          placeholder="Nach Namen suchen …"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <Banner variant="error" className="contacts-error">
          {error}
        </Banner>
      ) : null}

      {loading && users.length === 0 ? (
        <div className="stack" style={{ alignItems: 'center', padding: '48px 24px' }}>
          <Spinner size="lg" label="Wird geladen …" />
        </div>
      ) : users.length > 0 ? (
        <section className="contact-grid" aria-label="Nutzerverzeichnis" aria-busy={loading}>
          {users.map((user) => (
            <ContactEntry
              key={user.id}
              user={user}
              pending={pendingUserId === user.id}
              onSelect={(selected) => {
                void openChat(selected);
              }}
            />
          ))}
        </section>
      ) : loading ? null : (
        <EmptyState
          title="Keine Person gefunden"
          description="Versuche es mit einem anderen Namen oder einem Teil des Namens."
        />
      )}
    </AppShell>
  );
}
