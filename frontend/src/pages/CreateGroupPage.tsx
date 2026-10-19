import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  SearchField,
  Spinner,
  TextField,
  buttonClassName,
  cn,
} from '../components';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import './group-screens.css';
import type { ChatOut, UserOut } from '../lib/types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validatePhoto(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'Bitte wähle eine Datei im Format JPEG, PNG oder WebP.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.';
  }
  return null;
}

function GroupPlaceholder() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.5-3.1 2.5-5 5.5-5s5 1.9 5.5 5" />
      <path d="M16 8.4a3 3 0 0 1 0 5.7M17 14c2.1.5 3.4 2.2 3.8 4.5" />
    </svg>
  );
}

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOut[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    let active = true;
    setUsersLoading(true);
    setUsersError(null);

    const term = search.trim();
    const path = term ? `/api/users?search=${encodeURIComponent(term)}` : '/api/users';

    api
      .get<UserOut[]>(path)
      .then((result) => {
        if (!active) {
          return;
        }
        setUsers(result);
        setUsersLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setUsers([]);
        setUsersLoading(false);
        setUsersError(
          error instanceof ApiError ? error.message : 'Die Kontakte konnten nicht geladen werden.',
        );
      });

    return () => {
      active = false;
    };
  }, [search]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const nameError =
    (nameTouched || submitAttempted) && name.trim().length === 0
      ? 'Bitte gib der Gruppe einen Namen.'
      : '';
  const memberError =
    submitAttempted && selected.size === 0
      ? 'Wähle mindestens eine Person für die Gruppe aus.'
      : '';

  const toggleMember = (userId: string) => {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const message = validatePhoto(file);
    if (message) {
      setPhoto(null);
      setPhotoError(message);
      event.target.value = '';
      return;
    }

    setPhotoError(null);
    setPhoto(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setFormError(null);

    if (createdChatId) {
      navigate(`/chats/${createdChatId}`);
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || selected.size === 0) {
      return;
    }

    setSubmitting(true);
    try {
      const chat = await api.post<ChatOut>('/api/groups', {
        name: trimmedName,
        member_ids: selectedIds,
      });

      if (photo) {
        try {
          await api.upload<ChatOut>(`/api/groups/${chat.id}/photo`, photo);
        } catch (error) {
          setCreatedChatId(chat.id);
          setFormError(
            error instanceof ApiError
              ? `Die Gruppe wurde erstellt, aber das Foto konnte nicht gespeichert werden: ${error.message}`
              : 'Die Gruppe wurde erstellt, aber das Foto konnte nicht gespeichert werden. Du kannst es in der Gruppeninfo erneut wählen.',
          );
          return;
        }
      }

      navigate(`/chats/${chat.id}`);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Die Gruppe konnte nicht erstellt werden.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="page--narrow">
        <header className="page-header">
          <div className="page-header__copy">
            <div className="eyebrow">Neue Gruppe · Schritt 1 von 1</div>
            <h1>Neue Gruppe</h1>
            <p className="page-subtitle">
              Gib der Gruppe einen Namen, wähle ein Foto und lade die Kolleg:innen ein, die
              mitreden sollen.
            </p>
          </div>
          <div className="page-actions">
            <Link to="/chats" className={buttonClassName({ variant: 'ghost' })}>
              Abbrechen
            </Link>
          </div>
        </header>

        <form className="settings-card" noValidate onSubmit={handleSubmit}>
          <div className="settings-card__head">
            <h2>Gruppe einrichten</h2>
            <p>
              Du wirst automatisch Admin der neuen Gruppe. Weitere Admins kannst du später in der
              Gruppeninfo bestimmen.
            </p>
          </div>

          <div className="form-stack">
            <div className="group-identity">
              <div className="group-identity__preview" aria-hidden="true">
                {photoPreview ? (
                  <img src={photoPreview} alt="" />
                ) : (
                  <GroupPlaceholder />
                )}
              </div>
              <div className="group-identity__body">
                <TextField
                  label="Gruppenname"
                  placeholder="Zum Beispiel: Design-Review"
                  maxLength={60}
                  autoComplete="off"
                  value={name}
                  error={nameError}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => setNameTouched(true)}
                />
              </div>
            </div>

            <div className="field">
              <span className="label">
                Gruppenfoto <span className="muted field__optional">(optional)</span>
              </span>
              <label className="upload-box upload-box--compact" htmlFor="group-photo-input">
                <span className="upload-box__icon">
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 16V4M7 9l5-5 5 5" />
                    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  </svg>
                </span>
                <span className="upload-box--compact__body">
                  <strong>{photo ? photo.name : 'Foto auswählen'}</strong>
                  <span>JPEG, PNG oder WebP · maximal 5 MB</span>
                </span>
                <input
                  ref={photoInputRef}
                  id="group-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                />
              </label>
              {photoError ? <Banner variant="error">{photoError}</Banner> : null}
            </div>

            <div className="field">
              <div className="section-head section-head--tight">
                <div>
                  <span className="label">Mitglieder</span>
                  <div className="field__hint">
                    Wähle mindestens eine Person aus deinem Kontaktverzeichnis.
                  </div>
                </div>
                <span className="selected-count">{selected.size} ausgewählt</span>
              </div>

              <SearchField
                label="Personen durchsuchen"
                placeholder="Nach Namen suchen …"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                containerClassName="member-picker-search"
              />

              <div className="member-picker" aria-busy={usersLoading || undefined}>
                {usersLoading ? (
                  <div className="member-picker__state">
                    <Spinner size="sm" />
                  </div>
                ) : usersError ? (
                  <div className="member-picker__state">
                    <Banner variant="error">{usersError}</Banner>
                  </div>
                ) : users.length === 0 ? (
                  <EmptyState
                    title={search.trim() ? 'Keine Personen gefunden' : 'Keine Kontakte vorhanden'}
                    description={
                      search.trim()
                        ? 'Versuche es mit einem anderen Suchbegriff.'
                        : 'Sobald weitere Kolleg:innen registriert sind, erscheinen sie hier.'
                    }
                    className="empty-state--compact"
                  />
                ) : (
                  users.map((user) => (
                    <label
                      key={user.id}
                      className={cn('member-option', selected.has(user.id) && 'is-selected')}
                    >
                      <input
                        type="checkbox"
                        name="members"
                        value={user.id}
                        checked={selected.has(user.id)}
                        onChange={() => toggleMember(user.id)}
                      />
                      <Avatar
                        src={user.avatar_url}
                        name={user.display_name}
                        size="sm"
                        alt=""
                      />
                      <span className="member-option__body">
                        <span className="member-option__name">{user.display_name}</span>
                        {user.status_text ? (
                          <span className="member-option__info">{user.status_text}</span>
                        ) : null}
                      </span>
                    </label>
                  ))
                )}
              </div>

              {memberError ? <Banner variant="error">{memberError}</Banner> : null}
            </div>

            <div className="inline-note inline-note--info">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <span>
                Alle ausgewählten Personen sehen den bisherigen Chatverlauf erst ab dem Zeitpunkt
                ihres Beitritts — nicht rückwirkend.
              </span>
            </div>

            {formError ? <Banner variant="error">{formError}</Banner> : null}

            <div className="form-actions">
              <Link to="/chats" className={buttonClassName({ variant: 'ghost' })}>
                Abbrechen
              </Link>
              <Button type="submit" variant="primary" loading={submitting}>
                {createdChatId ? 'Zum Chat' : 'Gruppe erstellen'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
