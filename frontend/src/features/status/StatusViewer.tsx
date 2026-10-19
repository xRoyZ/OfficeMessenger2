import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Banner, Spinner } from '../../components';
import { ApiError, api } from '../../lib/api';
import { useAuthedBlobUrl } from '../../lib/assets';
import type { StatusGroupOut, StatusItemOut, ViewerOut } from '../../lib/types';
import { formatStatusTime } from './StatusStrip';
import './status.css';

export interface StatusViewerProps {
  statusId?: string;
}

function latestItem(group: StatusGroupOut): StatusItemOut | null {
  return group.items[group.items.length - 1] ?? null;
}

function expiryLabel(iso: string): string {
  const remaining = new Date(iso).getTime() - Date.now();
  const hours = Math.max(0, Math.ceil(remaining / 3_600_000));
  if (hours <= 1) {
    return 'Verschwindet in weniger als einer Stunde';
  }
  return `Verschwindet in ${hours} Stunden`;
}

function itemCountLabel(count: number): string {
  return count === 1 ? '1 Bild' : `${count} Bilder`;
}

function pickInitialGroup(groups: StatusGroupOut[], statusId: string | undefined): StatusGroupOut | null {
  if (statusId) {
    const byUser = groups.find((group) => group.user.id === statusId);
    if (byUser) {
      return byUser;
    }
    const byItem = groups.find((group) => group.items.some((item) => item.id === statusId));
    if (byItem) {
      return byItem;
    }
  }
  return groups[0] ?? null;
}

function CloseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </svg>
  );
}

export function StatusViewer({ statusId }: StatusViewerProps) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StatusGroupOut[] | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<ViewerOut[] | null>(null);

  const loadGroups = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<StatusGroupOut[]>('/api/status');
      const live = result.filter((group) => group.items.length > 0);
      setGroups(live);
      setCurrentGroupId((previous) => {
        if (previous && live.some((group) => group.user.id === previous)) {
          return previous;
        }
        return pickInitialGroup(live, statusId)?.user.id ?? null;
      });
      setIndex(0);
    } catch (caught: unknown) {
      setGroups([]);
      setCurrentGroupId(null);
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Der Status konnte nicht geladen werden.',
      );
    }
  }, [statusId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const currentGroup = groups?.find((group) => group.user.id === currentGroupId) ?? null;
  const currentItem = currentGroup?.items[index] ?? null;
  const imageUrl = useAuthedBlobUrl(currentItem?.image_url ?? null);
  const avatarUrl = useAuthedBlobUrl(currentGroup?.user.avatar_url ?? null);

  useEffect(() => {
    if (!currentItem) {
      return;
    }
    void api.post(`/api/status/${currentItem.id}/view`).catch(() => undefined);
  }, [currentItem]);

  useEffect(() => {
    if (!currentGroup?.is_own || !currentItem) {
      setViewers(null);
      return;
    }

    let active = true;
    api
      .get<ViewerOut[]>(`/api/status/${currentItem.id}/viewers`)
      .then((result) => {
        if (active) {
          setViewers(result);
        }
      })
      .catch(() => {
        if (active) {
          setViewers([]);
        }
      });

    return () => {
      active = false;
    };
  }, [currentGroup?.is_own, currentItem]);

  const close = () => {
    navigate('/chats');
  };

  const advance = () => {
    if (!currentGroup || !groups) {
      return;
    }
    if (index + 1 < currentGroup.items.length) {
      setIndex(index + 1);
      return;
    }

    const position = groups.findIndex((group) => group.user.id === currentGroup.user.id);
    const nextGroup = position >= 0 ? groups[position + 1] : undefined;
    if (nextGroup) {
      setCurrentGroupId(nextGroup.user.id);
      setIndex(0);
      navigate(`/status/${nextGroup.user.id}`, { replace: true });
      return;
    }

    close();
  };

  const selectGroup = (group: StatusGroupOut) => {
    setCurrentGroupId(group.user.id);
    setIndex(0);
    navigate(`/status/${group.user.id}`, { replace: true });
  };

  if (groups === null) {
    return (
      <div className="viewer-shell viewer-shell--with-panel">
        <div className="viewer-message">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-shell viewer-shell--with-panel">
        <div className="viewer-message">
          <div className="stack gap-3">
            <Banner variant="error">{error}</Banner>
            <button type="button" className="btn btn--accent" onClick={() => void loadGroups()}>
              Erneut versuchen
            </button>
            <Link className="btn btn--outline" to="/chats">
              Zu den Chats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentGroup || !currentItem) {
    return (
      <div className="viewer-shell viewer-shell--with-panel">
        <div className="viewer-message">
          <div className="stack gap-3">
            <h1>Kein aktiver Status</h1>
            <p>Dieser Status ist nicht mehr verfügbar.</p>
            <Link className="btn btn--accent" to="/chats">
              Zu den Chats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const latest = latestItem(currentGroup);
  const imageAlt = currentItem.caption
    ? `Statusbild von ${currentGroup.user.display_name}: ${currentItem.caption}`
    : `Statusbild von ${currentGroup.user.display_name}`;
  const personSub = [formatStatusTime(currentItem.created_at), currentGroup.user.status_text]
    .filter((part) => Boolean(part))
    .join(' · ');

  return (
    <div className="viewer-shell viewer-shell--with-panel">
      <section
        className="viewer-stage"
        data-viewer-stage
        aria-label="Statusanzeige"
        onClick={advance}
      >
        {imageUrl ? (
          <img className="viewer-stage__image" src={imageUrl} alt={imageAlt} data-od-id="status-viewer-image" />
        ) : null}
        <div className="viewer-stage__scrim" />

        <div className="viewer-top">
          <div className="viewer-progress" aria-hidden="true">
            {currentGroup.items.map((item, itemIndex) => (
              <div
                key={item.id}
                className={
                  itemIndex < index
                    ? 'viewer-progress__seg is-done'
                    : itemIndex === index
                      ? 'viewer-progress__seg is-active'
                      : 'viewer-progress__seg'
                }
              >
                <span className="viewer-progress__fill" />
              </div>
            ))}
          </div>
          <div className="viewer-person">
            <Avatar src={avatarUrl} name={currentGroup.user.display_name} size="md" alt="" />
            <div className="viewer-person__body">
              <div className="viewer-person__name">{currentGroup.user.display_name}</div>
              <div className="viewer-person__time">{personSub}</div>
            </div>
            <button
              className="viewer-close"
              type="button"
              aria-label="Status schließen"
              onClick={(event) => {
                event.stopPropagation();
                close();
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {currentItem.caption ? (
          <div className="viewer-caption">
            <h1 id="viewer-caption" aria-live="polite">
              {currentItem.caption}
            </h1>
            <p>
              Status von {currentGroup.user.display_name} · verschwindet nach 24 Stunden
            </p>
          </div>
        ) : null}

        <div className="viewer-nav" onClick={(event) => event.stopPropagation()}>
          <span className="viewer-nav__hint">Weiter tippen</span>
          <button
            className="viewer-nav__button"
            type="button"
            aria-label="Nächster Status"
            onClick={advance}
          >
            <NextIcon />
          </button>
        </div>

        <div className="viewer-legal" onClick={(event) => event.stopPropagation()}>
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
        </div>
      </section>

      <aside className="viewer-panel" aria-labelledby="viewer-panel-heading">
        <div className="viewer-panel__head">
          <div className="eyebrow">Status · 24 Stunden</div>
          <h2 id="viewer-panel-heading">{currentGroup.user.display_name}</h2>
          <p>
            {itemCountLabel(currentGroup.items.length)}
            {latest ? ` · ${formatStatusTime(latest.created_at)} geteilt` : ''}
          </p>
        </div>

        {currentGroup.is_own ? (
          <>
            <div className="viewer-panel__count">Betrachter</div>
            <ul className="viewer-list">
              {viewers === null ? (
                <li className="viewer-list__empty">Wird geladen …</li>
              ) : viewers.length === 0 ? (
                <li className="viewer-list__empty">Noch keine Betrachter.</li>
              ) : (
                viewers.map((viewer) => (
                  <li className="viewer-list__item" key={viewer.user.id}>
                    <ViewerRow viewer={viewer} />
                  </li>
                ))
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="viewer-panel__count">Status im Team</div>
            <ul className="viewer-list">
              {(groups ?? []).map((group) => {
                const groupLatest = latestItem(group);
                const isActive = group.user.id === currentGroup.user.id;
                return (
                  <li
                    className={isActive ? 'viewer-list__item is-active' : 'viewer-list__item'}
                    key={group.user.id}
                  >
                    <button
                      type="button"
                      className="viewer-list__link"
                      onClick={() => selectGroup(group)}
                      aria-label={`Status von ${group.user.display_name} ansehen`}
                    >
                      <GroupAvatar user={group.user} />
                      <span className="viewer-list__body">
                        <span className="viewer-list__name">{group.user.display_name}</span>
                        <span className="viewer-list__time">
                          {groupLatest ? formatStatusTime(groupLatest.created_at) : ''}
                        </span>
                      </span>
                      {isActive ? (
                        <span className="viewer-list__check" data-viewer-current>
                          <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="viewer-panel__foot">
          <div className="viewer-panel__expiry">
            <ClockIcon />
            <span>{expiryLabel(currentItem.expires_at)}</span>
          </div>
          <div className="viewer-panel__legal">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutzerklärung</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ViewerRow({ viewer }: { viewer: ViewerOut }) {
  const avatarUrl = useAuthedBlobUrl(viewer.user.avatar_url);
  return (
    <>
      <Avatar src={avatarUrl} name={viewer.user.display_name} size="sm" alt="" />
      <span className="viewer-list__body">
        <span className="viewer-list__name">{viewer.user.display_name}</span>
        <span className="viewer-list__time">{formatStatusTime(viewer.viewed_at)}</span>
      </span>
    </>
  );
}

function GroupAvatar({ user }: { user: StatusGroupOut['user'] }) {
  const avatarUrl = useAuthedBlobUrl(user.avatar_url);
  return <Avatar src={avatarUrl} name={user.display_name} size="sm" alt="" />;
}
