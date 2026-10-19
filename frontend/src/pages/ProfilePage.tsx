import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Modal,
  PasswordField,
  TextareaField,
  TextField,
  buttonClassName,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import { useAuthedBlobUrl } from '../lib/assets';
import type { MeOut } from '../lib/types';
import './ProfilePage.css';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const AVATAR_TYPE_ERROR = 'Bitte wähle eine Datei im Format JPEG, PNG oder WebP.';
const AVATAR_SIZE_ERROR = 'Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.';
const SAVE_SUCCESS = 'Profil gespeichert. Deine Änderungen sind für das Team sichtbar.';
const PASSWORD_SUCCESS = 'Passwort geändert. Deine aktuelle Sitzung bleibt bestehen.';

function BackIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function messageForError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

function validateAvatar(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return AVATAR_TYPE_ERROR;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return AVATAR_SIZE_ERROR;
  }
  return null;
}

interface PasswordErrors {
  current?: string;
  next?: string;
  repeat?: string;
}

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const avatarUrl = useAuthedBlobUrl(user?.avatar_url ?? null);

  const [name, setName] = useState(user?.display_name ?? '');
  const [statusText, setStatusText] = useState(user?.status_text ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    variant: 'success' | 'error';
    text: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState({
    current: false,
    next: false,
    repeat: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<{
    variant: 'success' | 'error';
    text: string;
  } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setName(user.display_name);
    setStatusText(user.status_text ?? '');
  }, [user?.id, user?.display_name, user?.status_text]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  if (!user) {
    return (
      <AppShell>
        <p className="muted" role="status">
          Wird geladen …
        </p>
      </AppShell>
    );
  }

  const shownAvatar = avatarPreview ?? avatarUrl;
  const nameError = nameTouched && name.trim().length === 0 ? 'Bitte gib einen Anzeigenamen ein.' : undefined;

  const clearPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAvatarPreview(null);
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || uploadingAvatar) {
      return;
    }

    const validationError = validateAvatar(file);
    if (validationError) {
      setAvatarError(validationError);
      clearPreview();
      input.value = '';
      return;
    }

    setAvatarError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setAvatarPreview(preview);
    setUploadingAvatar(true);

    try {
      const updated = await api.upload<MeOut>('/api/profile/avatar', file);
      setUser(updated);
    } catch (error) {
      clearPreview();
      setAvatarError(messageForError(error, 'Das Profilbild konnte nicht gespeichert werden.'));
    } finally {
      setUploadingAvatar(false);
      input.value = '';
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameTouched(true);
    setProfileMessage(null);

    if (name.trim().length === 0) {
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await api.patch<MeOut>('/api/profile', {
        display_name: name.trim(),
        status_text: statusText.trim() || null,
      });
      setUser(updated);
      setProfileMessage({ variant: 'success', text: SAVE_SUCCESS });
    } catch (error) {
      setProfileMessage({
        variant: 'error',
        text: messageForError(error, 'Das Profil konnte nicht gespeichert werden.'),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const collectPasswordErrors = (): PasswordErrors => {
    const errors: PasswordErrors = {};
    if (currentPassword.length === 0) {
      errors.current = 'Bitte gib dein aktuelles Passwort ein.';
    }
    if (newPassword.length < 8) {
      errors.next = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.';
    }
    if (repeatPassword !== newPassword) {
      errors.repeat = 'Die Passwörter stimmen nicht überein.';
    }
    return errors;
  };

  const visiblePasswordError = (field: keyof PasswordErrors): string | undefined => {
    if (!passwordTouched[field]) {
      return undefined;
    }
    return passwordErrors[field];
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordTouched({ current: true, next: true, repeat: true });
    setPasswordMessage(null);

    const errors = collectPasswordErrors();
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSavingPassword(true);
    try {
      await api.post<void>('/api/profile/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setPasswordTouched({ current: false, next: false, repeat: false });
      setPasswordErrors({});
      setPasswordMessage({ variant: 'success', text: PASSWORD_SUCCESS });
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setPasswordErrors({ current: error.message });
      }
      setPasswordMessage({
        variant: 'error',
        text: messageForError(error, 'Das Passwort konnte nicht geändert werden.'),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.del<void>('/api/profile');
    } catch (error) {
      setDeleteError(messageForError(error, 'Das Konto konnte nicht gelöscht werden.'));
      setDeleting(false);
      return;
    }

    await Promise.allSettled([logout()]);
    navigate('/anmelden?konto=geloescht', { replace: true });
  };

  return (
    <AppShell>
      <div className="profile-page">
      <header className="page-header" data-od-id="profile-header">
        <div className="page-header__copy">
          <div className="eyebrow">Konto · {user.display_name}</div>
          <h1>Profil</h1>
          <p className="page-subtitle">
            So sehen dich deine Kolleg:innen im Messenger. Änderungen sind sofort für das Team
            sichtbar.
          </p>
        </div>
        <div className="page-actions">
          <Link className={buttonClassName({ variant: 'outline' })} to="/chats">
            <BackIcon />
            Zu den Chats
          </Link>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="profile-card" aria-labelledby="profile-card-name" data-od-id="profile-card">
          <div className="profile-card__top">
            <div className="profile-card__avatar">
              <Avatar
                src={shownAvatar}
                name={user.display_name}
                size="xxl"
                alt={`Profilbild von ${user.display_name}`}
              />
              <Badge>Online</Badge>
            </div>
            <div>
              <h2 id="profile-card-name">{user.display_name}</h2>
              <div className="profile-card__handle">{user.email}</div>
            </div>
          </div>
          <p className="profile-card__quote">{user.status_text || 'Noch kein Statustext.'}</p>
        </aside>

        <div className="settings-stack">
          <section
            className="settings-card"
            aria-labelledby="avatar-heading"
            data-od-id="profile-avatar-card"
          >
            <div className="settings-card__head">
              <h2 id="avatar-heading">Profilbild</h2>
              <p>Ein klares Gesicht hilft im Team. Dein Bild ersetzt die Initialen überall im Messenger.</p>
            </div>
            <div className="avatar-editor">
              <Avatar
                src={shownAvatar}
                name={user.display_name}
                size="lg"
                alt="Aktuelles Profilbild"
              />
              <div className="avatar-editor__body">
                <div className="avatar-editor__title">Dein Profilbild</div>
                <p className="avatar-editor__hint">JPEG, PNG oder WebP · maximal 5 MB</p>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  Bild auswählen
                </Button>
                <input
                  ref={avatarInputRef}
                  id="profile-avatar-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(event) => {
                    void handleAvatarChange(event);
                  }}
                />
              </div>
            </div>
            {avatarError ? (
              <Banner variant="error" className="profile-avatar-message">
                {avatarError}
              </Banner>
            ) : null}
          </section>

          <section
            className="settings-card"
            aria-labelledby="profile-data-heading"
            data-od-id="profile-data-card"
          >
            <div className="settings-card__head">
              <h2 id="profile-data-heading">Profildaten</h2>
              <p>Name und Statustext werden in Chats, Kontakten und im Profil angezeigt.</p>
            </div>
            <form className="form-stack" id="profile-form" noValidate onSubmit={handleProfileSubmit}>
              <div className="form-grid">
                <TextField
                  id="profile-name"
                  label="Anzeigename"
                  type="text"
                  value={name}
                  maxLength={60}
                  autoComplete="name"
                  error={nameError}
                  onChange={(event) => {
                    setName(event.currentTarget.value);
                    setNameTouched(true);
                  }}
                />
                <TextField
                  id="profile-email"
                  label="E-Mail-Adresse"
                  type="email"
                  value={user.email}
                  readOnly
                  hint="Die E-Mail-Adresse ist mit deinem Konto verknüpft."
                  onChange={() => undefined}
                />
              </div>
              <TextareaField
                id="profile-info"
                label="Statustext"
                value={statusText}
                maxLength={160}
                hint="Bis zu 160 Zeichen. Erscheint unter deinem Namen im Profil."
                onChange={(event) => setStatusText(event.currentTarget.value)}
              />
              {profileMessage ? (
                <Banner variant={profileMessage.variant} className="profile-form-message">
                  {profileMessage.text}
                </Banner>
              ) : null}
              <div className="form-actions">
                <Button type="submit" variant="primary" loading={savingProfile}>
                  Profil speichern
                </Button>
              </div>
            </form>
          </section>

          <section
            className="settings-card"
            aria-labelledby="password-heading"
            data-od-id="profile-password-card"
          >
            <div className="settings-card__head">
              <h2 id="password-heading">Passwort ändern</h2>
              <p>Das neue Passwort muss mindestens 8 Zeichen lang sein.</p>
            </div>
            <form className="form-stack" id="password-form" noValidate onSubmit={handlePasswordSubmit}>
              <PasswordField
                id="password-current"
                label="Aktuelles Passwort"
                autoComplete="current-password"
                value={currentPassword}
                error={visiblePasswordError('current')}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setCurrentPassword(value);
                  setPasswordTouched((touched) => ({ ...touched, current: true }));
                  setPasswordErrors((errors) => ({
                    ...errors,
                    current: value.length === 0 ? 'Bitte gib dein aktuelles Passwort ein.' : undefined,
                  }));
                }}
              />
              <div className="form-grid">
                <PasswordField
                  id="password-new"
                  label="Neues Passwort"
                  autoComplete="new-password"
                  value={newPassword}
                  error={visiblePasswordError('next')}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setNewPassword(value);
                    setPasswordTouched((touched) => ({ ...touched, next: true }));
                    setPasswordErrors((errors) => ({
                      ...errors,
                      next:
                        value.length < 8
                          ? 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'
                          : undefined,
                    }));
                  }}
                />
                <PasswordField
                  id="password-repeat"
                  label="Neues Passwort wiederholen"
                  autoComplete="new-password"
                  value={repeatPassword}
                  error={visiblePasswordError('repeat')}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setRepeatPassword(value);
                    setPasswordTouched((touched) => ({ ...touched, repeat: true }));
                    setPasswordErrors((errors) => ({
                      ...errors,
                      repeat:
                        value !== newPassword ? 'Die Passwörter stimmen nicht überein.' : undefined,
                    }));
                  }}
                />
              </div>
              {passwordMessage ? (
                <Banner variant={passwordMessage.variant} className="profile-form-message">
                  {passwordMessage.text}
                </Banner>
              ) : null}
              <div className="form-actions">
                <Button type="submit" variant="outline" loading={savingPassword}>
                  Passwort ändern
                </Button>
              </div>
            </form>
          </section>

          <section
            className="settings-card danger-zone"
            aria-labelledby="delete-heading"
            data-od-id="profile-delete-card"
          >
            <div className="settings-card__head">
              <h3 id="delete-heading">Konto löschen</h3>
              <p>Dein Konto, deine Profildaten und deine Statusbilder werden dauerhaft entfernt.</p>
            </div>
            <div className="danger-row">
              <div>
                <div className="avatar-editor__title">Konto endgültig löschen</div>
                <p>Du wirst abgemeldet. Deine Nachrichten bleiben für das Team sichtbar.</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                Konto löschen
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
          }
        }}
        title="Konto löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        warning="Dein Profil, deine Statusbilder und deine Anmeldung werden gelöscht. Deine Nachrichten bleiben für die anderen Mitglieder sichtbar."
        onSubmit={(event) => {
          void handleDelete(event);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              type="button"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Abbrechen
            </Button>
            <Button variant="danger" type="submit" loading={deleting}>
              Konto endgültig löschen
            </Button>
          </>
        }
      >
        {deleteError ? <Banner variant="error">{deleteError}</Banner> : null}
      </Modal>
      </div>
    </AppShell>
  );
}
