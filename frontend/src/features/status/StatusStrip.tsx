import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, Banner, Skeleton, cn } from '../../components';
import { ApiError, api } from '../../lib/api';
import { useAuthedBlobUrl } from '../../lib/assets';
import type { StatusGroupOut } from '../../lib/types';
import './status.css';

export interface StatusStripProps {
  onOpen: (statusId: string) => void;
}

export function formatStatusTime(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return '';
  }

  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 1) {
    return 'gerade eben';
  }
  if (minutes < 60) {
    return `vor ${minutes} Min.`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `vor ${hours} Std.`;
  }

  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function latestItem(group: StatusGroupOut) {
  return group.items[group.items.length - 1] ?? null;
}

function GroupAvatar({ group }: { group: StatusGroupOut }) {
  const avatarUrl = useAuthedBlobUrl(group.user.avatar_url);
  return <Avatar src={avatarUrl} name={group.user.display_name} size="sm" alt="" />;
}

function AddIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

interface OwnEntryProps {
  group: StatusGroupOut | null;
  onOpen: (statusId: string) => void;
}

function OwnEntry({ group, onOpen }: OwnEntryProps) {
  const latest = group ? latestItem(group) : null;

  return (
    <div
      className={cn('status-item', 'status-item--self', group && 'has-status')}
      data-testid="status-self"
    >
      <span className="status-item__ring-wrap">
        {group ? (
          <button
            type="button"
            className="status-ring"
            aria-label="Eigenen Status ansehen"
            onClick={() => onOpen(group.user.id)}
          >
            <span className="status-ring__inner">
              <GroupAvatar group={group} />
            </span>
          </button>
        ) : (
          <Link
            className="status-ring"
            to="/status/neu"
            aria-label="Eigenen Status hinzufügen"
          >
            <span className="status-ring__inner" />
          </Link>
        )}
        {group ? (
          <Link
            className="status-item__add"
            to="/status/neu"
            aria-label="Eigenen Status hinzufügen"
          >
            <AddIcon />
          </Link>
        ) : (
          <span className="status-item__add" aria-hidden="true">
            <AddIcon />
          </span>
        )}
      </span>
      <span className="status-item__name">Mein Status</span>
      <span className="status-item__time">{latest ? formatStatusTime(latest.created_at) : 'Hinzufügen'}</span>
    </div>
  );
}

interface OtherEntryProps {
  group: StatusGroupOut;
  onOpen: (statusId: string) => void;
}

function OtherEntry({ group, onOpen }: OtherEntryProps) {
  const latest = latestItem(group);

  return (
    <button
      type="button"
      className={cn('status-item', !group.has_unseen && 'is-seen')}
      onClick={() => onOpen(group.user.id)}
      aria-label={`Status von ${group.user.display_name} ansehen`}
    >
      <span className="status-item__ring-wrap">
        <span className="status-ring">
          <span className="status-ring__inner">
            <GroupAvatar group={group} />
          </span>
        </span>
      </span>
      <span className="status-item__name">{firstName(group.user.display_name)}</span>
      <span className="status-item__time">
        {latest ? formatStatusTime(latest.created_at) : ''}
      </span>
    </button>
  );
}

export function StatusStrip({ onOpen }: StatusStripProps) {
  const location = useLocation();
  const [groups, setGroups] = useState<StatusGroupOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);

    api
      .get<StatusGroupOut[]>('/api/status')
      .then((result) => {
        if (active) {
          setGroups(result);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        setGroups([]);
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Der Status konnte nicht geladen werden.',
        );
      });

    return () => {
      active = false;
    };
  }, [location.key]);

  const own = groups?.find((group) => group.is_own) ?? null;
  const others = groups?.filter((group) => !group.is_own) ?? [];

  return (
    <section className="status-card" aria-labelledby="status-heading" data-od-id="status-strip">
      <div className="status-card__head">
        <div className="status-card__title" id="status-heading">
          <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5v5l3 2" />
          </svg>
          Status
        </div>
        <span className="eyebrow">Verschwindet nach 24 Std.</span>
      </div>

      {error ? <Banner variant="error">{error}</Banner> : null}

      <div className="status-rail">
        <OwnEntry group={own} onOpen={onOpen} />
        {groups === null
          ? [0, 1, 2].map((index) => (
              <div className="status-item" key={index} aria-hidden="true">
                <Skeleton variant="circle" width={59} height={59} />
                <Skeleton variant="text" width={48} />
              </div>
            ))
          : others.map((group) => (
              <OtherEntry key={group.user.id} group={group} onOpen={onOpen} />
            ))}
      </div>
    </section>
  );
}
