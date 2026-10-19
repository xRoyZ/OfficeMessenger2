import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  EmptyState,
  SearchField,
  Spinner,
  TextField,
  buttonClassName,
  cn,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import './group-screens.css';
import { useAuthedBlobUrl } from '../lib/assets';
import type { ChatMemberOut, ChatOut, UserOut } from '../lib/types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LAST_ADMIN_HINT =
  'Du bist die letzte Admin-Person. Mache zuerst jemand anderen zum Admin, bevor du die Gruppe verlässt oder deine Rechte abgibst.';

function validatePhoto(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'Bitte wähle eine Datei im Format JPEG, PNG oder WebP.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.';
  }
  return null;
}

function memberCountLabel(count: number): string {
  return count === 1 ? '1 Mitglied' : `${count} Mitglieder`;
}

function adminCountLabel(count: number): string {
  return count === 1 ? '1 Admin' : `${count} Admins`;
}

function memberAvatarUrl(member: ChatMemberOut): string | null {
  return member.user.avatar_url;
}

function MemberAvatar({ member }: { member: ChatMemberOut }) {
  const url = useAuthedBlobUrl(memberAvatarUrl(member));
  return <Avatar src={url} name={member.user.display_name} size="sm" alt="" />;
}

function ChatIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.4a7.4 7.4 0 0 1-7.4 7.4H8.2L4 22v-5.4a7.4 7.4 0 0 1 4.2-13.2h4.4A7.4 7.4 0 0 1 20 11.4Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

interface GroupSummaryProps {
  chat: ChatOut;
  photoUrl: string | null;
  adminCount: number;
  onAddMember?: () => void;
  onLeave: () => void;
  roleLabel: string;
}

function GroupSummary({
  chat,
  photoUrl,
  adminCount,
  onAddMember,
  onLeave,
  roleLabel,
}: GroupSummaryProps) {
  return (
    <aside className="group-summary" aria-labelledby="summary-heading">
      <div className={cn('group-summary__cover', !photoUrl && 'group-summary__cover--empty')}>
        {photoUrl ? <img src={photoUrl} alt="" /> : null}
      </div>
      <div className="group-summary__body">
        <Avatar
          src={photoUrl}
          name={chat.title}
          size="xl"
          alt={`Gruppenfoto von ${chat.title}`}
          className="group-summary__avatar"
        />
        <h2 id="summary-heading">{chat.title}</h2>
        <div className="group-summary__meta">
          <Badge variant="accent">{memberCountLabel(chat.member_count)}</Badge>
          <Badge variant="outline">{adminCountLabel(adminCount)}</Badge>
        </div>
        <div className="group-summary__actions">
          <Link
            to={`/chats/${chat.id}`}
            className={buttonClassName({ variant: 'primary', block: true })}
          >
            Zum Gruppenchat
          </Link>
          {onAddMember ? (
            <Button variant="outline" block onClick={onAddMember}>
              Mitglied hinzufügen
            </Button>
          ) : (
            <Button variant="outline" block onClick={onLeave}>
              Gruppe verlassen
            </Button>
          )}
        </div>
        <div className="group-summary__legal">
          <div>Gruppeninfo · nur für Mitglieder sichtbar</div>
          <div className="group-summary__role">Deine Rolle: {roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}

interface MemberTableProps {
  members: ChatMemberOut[];
  currentUserId: string | null;
  isAdmin: boolean;
  search: string;
  onPromote: (member: ChatMemberOut) => void;
  onDemote: (member: ChatMemberOut) => void;
  onRemove: (member: ChatMemberOut) => void;
  busy: boolean;
}

function MemberTable({
  members,
  currentUserId,
  isAdmin,
  search,
  onPromote,
  onDemote,
  onRemove,
  busy,
}: MemberTableProps) {
  const term = search.trim().toLocaleLowerCase('de-DE');
  const visibleMembers = term
    ? members.filter((member) =>
        member.user.display_name.toLocaleLowerCase('de-DE').includes(term),
      )
    : members;

  if (visibleMembers.length === 0) {
    return (
      <EmptyState
        title="Keine Mitglieder gefunden"
        description="Versuche es mit einem anderen Suchbegriff."
        className="empty-state--compact"
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Rolle</th>
            {isAdmin ? <th className="data-table__actions-head">Aktionen</th> : null}
          </tr>
        </thead>
        <tbody>
          {visibleMembers.map((member) => {
            const isSelf = member.user.id === currentUserId;
            return (
              <tr key={member.user.id}>
                <td data-label="Person">
                  <div className="member-cell">
                    <MemberAvatar member={member} />
                    <div>
                      <div className="member-cell__name">
                        {member.user.display_name}
                        {isSelf ? (
                          <span className="badge badge--outline member-cell__self">Du</span>
                        ) : null}
                      </div>
                      {member.user.status_text ? (
                        <div className="member-cell__info">{member.user.status_text}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td data-label="Rolle">
                  <Badge variant={member.role === 'admin' ? 'accent' : 'neutral'}>
                    {member.role === 'admin' ? 'Admin' : 'Mitglied'}
                  </Badge>
                </td>
                {isAdmin ? (
                  <td data-label="Aktionen">
                    {isSelf ? (
                      <div className="member-actions">
                        <Badge variant="outline">Eigene Rolle</Badge>
                      </div>
                    ) : (
                      <div className="member-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (member.role === 'admin') {
                              onDemote(member);
                            } else {
                              onPromote(member);
                            }
                          }}
                        >
                          {member.role === 'admin' ? 'Admin entziehen' : 'Zum Admin machen'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRemove(member)}
                        >
                          Entfernen
                        </Button>
                      </div>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LeaveDialogProps {
  open: boolean;
  title: string;
  description: string;
  warning: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function LeaveDialog({
  open,
  title,
  description,
  warning,
  busy,
  onClose,
  onConfirm,
}: LeaveDialogProps) {
  return (
    <DialogShell
      open={open}
      title="Gruppe verlassen?"
      description={description}
      warning={warning}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Bleiben
          </Button>
          <Button variant="danger" type="submit" loading={busy}>
            {title}
          </Button>
        </>
      }
    />
  );
}

interface DialogShellProps {
  open: boolean;
  title: string;
  description?: string;
  warning?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function DialogShell({
  open,
  title,
  description,
  warning,
  children,
  actions,
  onClose,
  onSubmit,
}: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) {
      return;
    }
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="group-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form className="dialog__panel" onSubmit={onSubmit}>
        <div className="dialog__head">
          <div>
            <h2 id="group-dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Dialog schließen"
            onClick={onClose}
          >
            <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Button>
        </div>
        {warning || children ? (
          <div className="dialog__body">
            {warning ? (
              <div className="dialog__warn">
                <InfoIcon />
                <span>{warning}</span>
              </div>
            ) : null}
            {children}
          </div>
        ) : null}
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </form>
    </dialog>
  );
}

export default function GroupSettingsPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [chat, setChat] = useState<ChatOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [renameName, setRenameName] = useState('');
  const [renameTouched, setRenameTouched] = useState(false);
  const [renameAttempted, setRenameAttempted] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [directory, setDirectory] = useState<UserOut[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [addSelected, setAddSelected] = useState<string[]>([]);

  const [removeTarget, setRemoveTarget] = useState<ChatMemberOut | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const photoUrl = useAuthedBlobUrl(chat?.photo_url ?? null);
  const ownAvatarUrl = useAuthedBlobUrl(user?.avatar_url ?? null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      setLoadError('Diese Gruppe konnte nicht gefunden werden.');
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    api
      .get<ChatOut>(`/api/chats/${chatId}`)
      .then((result) => {
        if (!active) {
          return;
        }
        setChat(result);
        setRenameName(result.title);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoadError(
          error instanceof ApiError ? error.message : 'Die Gruppe konnte nicht geladen werden.',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chatId]);

  useEffect(() => {
    if (!addOpen) {
      return;
    }

    let active = true;
    setDirectoryLoading(true);
    setDirectoryError(null);
    const term = addSearch.trim();
    const path = term ? `/api/users?search=${encodeURIComponent(term)}` : '/api/users';

    api
      .get<UserOut[]>(path)
      .then((result) => {
        if (!active) {
          return;
        }
        setDirectory(result);
        setDirectoryLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setDirectory([]);
        setDirectoryLoading(false);
        setDirectoryError(
          error instanceof ApiError ? error.message : 'Die Kontakte konnten nicht geladen werden.',
        );
      });

    return () => {
      active = false;
    };
  }, [addOpen, addSearch]);

  const members = chat?.members ?? [];
  const adminCount = useMemo(
    () => members.filter((member) => member.role === 'admin').length,
    [members],
  );
  const memberIds = useMemo(() => new Set(members.map((member) => member.user.id)), [members]);
  const currentUserId = user?.id ?? null;
  const isAdmin = chat?.role === 'admin';
  const isSoleAdmin = isAdmin && adminCount <= 1;

  const addCandidates = useMemo(
    () => directory.filter((candidate) => !memberIds.has(candidate.id)),
    [directory, memberIds],
  );

  const renameError =
    (renameTouched || renameAttempted) && renameName.trim().length === 0
      ? 'Bitte gib einen Gruppennamen ein.'
      : '';

  const runAction = async (
    task: () => Promise<ChatOut>,
    successMessage: string,
  ): Promise<ChatOut | null> => {
    setActionError(null);
    setActionSuccess(null);
    setBusy(true);
    try {
      const next = await task();
      setChat(next);
      setRenameName(next.title);
      setActionSuccess(successMessage);
      return next;
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Die Aktion konnte nicht ausgeführt werden.',
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRenameAttempted(true);
    const value = renameName.trim();
    if (!value || !chat) {
      return;
    }
    await runAction(
      () => api.patch<ChatOut>(`/api/groups/${chat.id}`, { name: value }),
      'Gruppenname gespeichert.',
    );
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !chat) {
      return;
    }

    const message = validatePhoto(file);
    if (message) {
      setPhotoError(message);
      setPhotoInputKey((current) => current + 1);
      return;
    }

    setPhotoError(null);
    setActionError(null);
    setActionSuccess(null);
    setBusy(true);
    try {
      const next = await api.upload<ChatOut>(`/api/groups/${chat.id}/photo`, file);
      setChat(next);
      setActionSuccess('Gruppenfoto aktualisiert.');
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Das Gruppenfoto konnte nicht gespeichert werden.',
      );
    } finally {
      setBusy(false);
      setPhotoInputKey((current) => current + 1);
    }
  };

  const handlePromote = (member: ChatMemberOut) => {
    if (!chat) {
      return;
    }
    void runAction(
      () =>
        api.post<ChatOut>(`/api/groups/${chat.id}/admins`, { user_id: member.user.id }),
      'Mitglied ist jetzt Admin.',
    );
  };

  const handleDemote = (member: ChatMemberOut) => {
    if (!chat) {
      return;
    }
    void runAction(
      () => api.del<ChatOut>(`/api/groups/${chat.id}/admins/${member.user.id}`),
      'Admin-Rechte entzogen.',
    );
  };

  const handleDemoteSelf = () => {
    if (!chat || !currentUserId) {
      return;
    }
    void runAction(
      () => api.del<ChatOut>(`/api/groups/${chat.id}/admins/${currentUserId}`),
      'Du bist jetzt Mitglied der Gruppe.',
    );
  };

  const handleRemove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chat || !removeTarget) {
      return;
    }
    const target = removeTarget;
    const next = await runAction(
      () => api.del<ChatOut>(`/api/groups/${chat.id}/members/${target.user.id}`),
      'Mitglied wurde entfernt.',
    );
    if (next) {
      setRemoveTarget(null);
    }
  };

  const handleAddMembers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chat || addSelected.length === 0) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setBusy(true);
    let latest: ChatOut | null = null;
    try {
      for (const userId of addSelected) {
        latest = await api.post<ChatOut>(`/api/groups/${chat.id}/members`, {
          user_id: userId,
        });
      }
      if (latest) {
        setChat(latest);
        setRenameName(latest.title);
        setActionSuccess('Mitglied wurde hinzugefügt.');
      }
      setAddOpen(false);
      setAddSelected([]);
      setAddSearch('');
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Das Mitglied konnte nicht hinzugefügt werden.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!chat) {
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      await api.post<void>(`/api/groups/${chat.id}/leave`);
      navigate('/chats');
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Die Gruppe konnte nicht verlassen werden.',
      );
      setLeaveOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleAddSelected = (userId: string) => {
    setAddSelected((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div className="group-state" role="status">
          <Spinner />
          <p className="muted">Gruppe wird geladen …</p>
        </div>
      </AppShell>
    );
  }

  if (loadError || !chat) {
    return (
      <AppShell>
        <Banner variant="error">{loadError ?? 'Die Gruppe konnte nicht geladen werden.'}</Banner>
        <div className="form-actions">
          <Link to="/chats" className={buttonClassName({ variant: 'outline' })}>
            Zurück zu den Chats
          </Link>
        </div>
      </AppShell>
    );
  }

  const selfMember = members.find((member) => member.user.id === currentUserId);
  const baseMessages = (
    <>
      {actionError ? <Banner variant="error">{actionError}</Banner> : null}
      {actionSuccess ? <Banner variant="success">{actionSuccess}</Banner> : null}
    </>
  );

  if (!isAdmin) {
    return (
      <AppShell>
        <header className="page-header">
          <div className="page-header__copy">
            <div className="eyebrow">Gruppe · Mitgliederansicht</div>
            <h1>{chat.title}</h1>
            <p className="page-subtitle">
              Du bist Mitglied dieser Gruppe. Name, Foto und Mitglieder werden von den Admins
              verwaltet.
            </p>
          </div>
          <div className="page-actions">
            <Link to={`/chats/${chat.id}`} className={buttonClassName({ variant: 'outline' })}>
              <ChatIcon />
              Zum Chat
            </Link>
          </div>
        </header>

        <div className="split-layout">
          <div className="settings-stack">
            {baseMessages}

            <section className="settings-card" aria-labelledby="member-role-heading">
              <div className="settings-card__head">
                <h2 id="member-role-heading">Deine Mitgliedschaft</h2>
                <p>Du hast die Rolle „Mitglied“.</p>
              </div>
              <div className="avatar-editor">
                <Avatar
                  src={ownAvatarUrl}
                  name={selfMember?.user.display_name ?? user?.display_name ?? chat.title}
                  size="lg"
                />
                <div className="avatar-editor__body">
                  <div className="avatar-editor__title">
                    {selfMember?.user.display_name ?? user?.display_name ?? 'Du'}
                  </div>
                  <p className="avatar-editor__hint">
                    {user?.email ?? selfMember?.user.status_text ?? ''}
                  </p>
                  <Badge>Mitglied</Badge>
                </div>
              </div>
              <div className="inline-note inline-note--info">
                <InfoIcon />
                <span>
                  Nur Admins können den Gruppennamen, das Foto und die Mitgliederliste bearbeiten.
                </span>
              </div>
            </section>

            <section className="members-card" aria-labelledby="member-list-heading">
              <div className="section-head">
                <div>
                  <h2 id="member-list-heading">Mitglieder</h2>
                  <p>
                    {memberCountLabel(chat.member_count)} · {adminCountLabel(adminCount)}
                  </p>
                </div>
                <Badge variant="outline">Nur Lesen</Badge>
              </div>
              <MemberTable
                members={members}
                currentUserId={currentUserId}
                isAdmin={false}
                search=""
                busy={false}
                onPromote={() => undefined}
                onDemote={() => undefined}
                onRemove={() => undefined}
              />
            </section>

            <section className="settings-card danger-zone" aria-labelledby="member-leave-heading">
              <div className="settings-card__head">
                <h3 id="member-leave-heading">Gruppe verlassen</h3>
                <p>Du erhältst danach keine neuen Nachrichten aus dieser Gruppe.</p>
              </div>
              <div className="danger-row">
                <div>
                  <div className="avatar-editor__title">„{chat.title}“ verlassen</div>
                  <p>Ein Wiedereintritt ist nur über eine Einladung möglich.</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setLeaveOpen(true)}>
                  Gruppe verlassen
                </Button>
              </div>
            </section>
          </div>

          <GroupSummary
            chat={chat}
            photoUrl={photoUrl}
            adminCount={adminCount}
            onLeave={() => setLeaveOpen(true)}
            roleLabel="Mitglied"
          />
        </div>

        <LeaveDialog
          open={leaveOpen}
          title="Gruppe verlassen"
          description={`Du erhältst keine neuen Nachrichten aus „${chat.title}“ mehr.`}
          warning="Der bisherige Verlauf bleibt für die anderen Mitglieder sichtbar. Du kannst nur über eine Einladung wieder beitreten."
          busy={busy}
          onClose={() => setLeaveOpen(false)}
          onConfirm={() => {
            void handleLeave();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Gruppe · {memberCountLabel(chat.member_count)}</div>
          <h1>Gruppeninfo</h1>
          <p className="page-subtitle">
            Name, Foto und Mitglieder von „{chat.title}“ verwalten. Du bist Admin dieser Gruppe.
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/chats/${chat.id}`} className={buttonClassName({ variant: 'outline' })}>
            <ChatIcon />
            Zum Chat
          </Link>
        </div>
      </header>

      <div className="split-layout">
        <div className="settings-stack">
          {baseMessages}

          <section className="settings-card" aria-labelledby="identity-heading">
            <div className="settings-card__head">
              <h2 id="identity-heading">Gruppenprofil</h2>
              <p>Der Name und das Foto sind für alle Mitglieder sichtbar.</p>
            </div>

            <div className="avatar-editor">
              <Avatar
                src={photoUrl}
                name={chat.title}
                size="lg"
                alt={`Gruppenfoto von ${chat.title}`}
              />
              <div className="avatar-editor__body">
                <div className="avatar-editor__title">Gruppenfoto</div>
                <p className="avatar-editor__hint">JPEG, PNG oder WebP · maximal 5 MB</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  Foto ändern
                </Button>
                <input
                  key={photoInputKey}
                  ref={photoInputRef}
                  id="group-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    void handlePhotoChange(event);
                  }}
                />
              </div>
            </div>
            {photoError ? <Banner variant="error">{photoError}</Banner> : null}

            <form className="form-stack group-name-form" noValidate onSubmit={handleRename}>
              <TextField
                label="Gruppenname"
                maxLength={60}
                autoComplete="off"
                value={renameName}
                error={renameError}
                onChange={(event) => setRenameName(event.target.value)}
                onBlur={() => setRenameTouched(true)}
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" loading={busy}>
                  Namen speichern
                </Button>
              </div>
            </form>
          </section>

          <section className="members-card" aria-labelledby="members-heading">
            <div className="section-head">
              <div>
                <h2 id="members-heading">Mitglieder</h2>
                <p>
                  {memberCountLabel(chat.member_count)} · {adminCountLabel(adminCount)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddOpen(true);
                  setAddSelected([]);
                  setAddSearch('');
                }}
              >
                <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Mitglied hinzufügen
              </Button>
            </div>

            <SearchField
              label="Mitglieder durchsuchen"
              placeholder="Mitglieder durchsuchen …"
              autoComplete="off"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              containerClassName="member-table-search"
            />

            <MemberTable
              members={members}
              currentUserId={currentUserId}
              isAdmin
              search={memberSearch}
              busy={busy}
              onPromote={handlePromote}
              onDemote={handleDemote}
              onRemove={(member) => setRemoveTarget(member)}
            />
          </section>

          <section className="settings-card danger-zone" aria-labelledby="danger-heading">
            <div className="settings-card__head">
              <h3 id="danger-heading">Zugriff &amp; Mitgliedschaft</h3>
              <p>Diese Aktionen betreffen deine eigene Rolle in der Gruppe.</p>
            </div>
            <div className="danger-row danger-row--spaced">
              <div>
                <div className="avatar-editor__title">Admin-Rechte abgeben</div>
                <p>Danach kannst du den Namen und die Mitglieder nicht mehr verwalten.</p>
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={handleDemoteSelf}>
                Admin-Rechte abgeben
              </Button>
            </div>
            {isSoleAdmin ? (
              <div className="inline-note">
                <InfoIcon />
                <span>{LAST_ADMIN_HINT}</span>
              </div>
            ) : null}
            <div className="danger-row">
              <div>
                <div className="avatar-editor__title">Gruppe verlassen</div>
                <p>Der Chat verschwindet aus deiner Chatliste. Andere Mitglieder bleiben.</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => setLeaveOpen(true)}
              >
                Gruppe verlassen
              </Button>
            </div>
          </section>
        </div>

        <GroupSummary
          chat={chat}
          photoUrl={photoUrl}
          adminCount={adminCount}
          onAddMember={() => {
            setAddOpen(true);
            setAddSelected([]);
            setAddSearch('');
          }}
          onLeave={() => setLeaveOpen(true)}
          roleLabel="Admin"
        />
      </div>

      <DialogShell
        open={addOpen}
        title="Mitglied hinzufügen"
        description="Wähle Personen aus deinem Kontaktverzeichnis."
        onClose={() => setAddOpen(false)}
        onSubmit={(event) => {
          void handleAddMembers(event);
        }}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={addSelected.length === 0 || busy}
            >
              Hinzufügen
            </Button>
          </>
        }
      >
        <div className="dialog-form-stack">
          <SearchField
            label="Personen durchsuchen"
            placeholder="Nach Namen suchen …"
            autoComplete="off"
            value={addSearch}
            onChange={(event) => setAddSearch(event.target.value)}
            containerClassName="member-picker-search"
          />
          <div className="member-picker" aria-busy={directoryLoading || undefined}>
            {directoryLoading ? (
              <div className="member-picker__state">
                <Spinner size="sm" />
              </div>
            ) : directoryError ? (
              <Banner variant="error">{directoryError}</Banner>
            ) : addCandidates.length === 0 ? (
              <EmptyState
                title="Keine weiteren Personen"
                description="Alle Kontakte sind bereits Mitglied dieser Gruppe."
                className="empty-state--compact"
              />
            ) : (
              addCandidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className={cn(
                    'member-option',
                    addSelected.includes(candidate.id) && 'is-selected',
                  )}
                >
                  <input
                    type="checkbox"
                    name="add-members"
                    value={candidate.id}
                    checked={addSelected.includes(candidate.id)}
                    onChange={() => toggleAddSelected(candidate.id)}
                  />
                  <Avatar
                    src={candidate.avatar_url}
                    name={candidate.display_name}
                    size="sm"
                    alt=""
                  />
                  <span className="member-option__body">
                    <span className="member-option__name">{candidate.display_name}</span>
                    {candidate.status_text ? (
                      <span className="member-option__info">{candidate.status_text}</span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </DialogShell>

      <DialogShell
        open={removeTarget !== null}
        title="Mitglied entfernen"
        description={
          removeTarget
            ? `${removeTarget.user.display_name} verliert den Zugriff auf die Gruppe und den Chatverlauf.`
            : undefined
        }
        warning="Die Person kann später erneut hinzugefügt werden. Bereits gesendete Nachrichten bleiben im Verlauf."
        onClose={() => setRemoveTarget(null)}
        onSubmit={(event) => {
          void handleRemove(event);
        }}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" type="submit" loading={busy}>
              Mitglied entfernen
            </Button>
          </>
        }
      />

      <LeaveDialog
        open={leaveOpen}
        title="Gruppe verlassen"
        description={`Du erhältst keine neuen Nachrichten aus „${chat.title}“ mehr.`}
        warning="Du kannst der Gruppe nur über eine Einladung wieder beitreten. Der bisherige Verlauf bleibt für die anderen Mitglieder sichtbar."
        busy={busy}
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => {
          void handleLeave();
        }}
      />
    </AppShell>
  );
}
