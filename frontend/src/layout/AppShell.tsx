import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar, DropdownMenu, Skeleton, cn } from '../components';
import { useAuth } from '../context/AuthContext';
import { useAuthedBlobUrl } from '../lib/assets';

export interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
}

function Brandmark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M6.4 9.2A6.2 6.2 0 0 1 12.6 3h7.2a6.2 6.2 0 0 1 6.2 6.2v5.7a6.2 6.2 0 0 1-6.2 6.2h-3.5l-5.7 4.3c-.9.7-2.1 0-2.1-1.1v-4.4a6.2 6.2 0 0 1-2.1-4.6Z"
        fill="currentColor"
      />
      <path
        d="M11.8 9.2h8.4M11.8 13.3h5.2"
        fill="none"
        stroke="#173f3a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatsIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.4a7.4 7.4 0 0 1-7.4 7.4H8.2L4 22v-5.4a7.4 7.4 0 0 1 4.2-13.2h4.4A7.4 7.4 0 0 1 20 11.4Z" />
      <path d="M8 9.5h7M8 13h4.5" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.5-3.1 2.5-5 5.5-5s5 1.9 5.5 5" />
      <path d="M16 8.4a3 3 0 0 1 0 5.7M17 14c2.1.5 3.4 2.2 3.8 4.5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.7 3.2-6 7-6s6.4 2.3 7 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 8-4 4 4 4" />
      <path d="M6 12h9" />
    </svg>
  );
}

export function AppShell({ children, header }: AppShellProps) {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const avatarUrl = useAuthedBlobUrl(user?.avatar_url ?? null);

  const handleLogout = () => {
    void Promise.allSettled([logout()]).then(() => {
      navigate('/anmelden', { replace: true });
    });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn('rail-link', isActive && 'is-active');

  return (
    <div className="app">
      <header className="rail" aria-label="App-Navigation">
        <Link className="brandmark" to="/chats" aria-label="OfficeMessenger2">
          <Brandmark />
        </Link>
        {header}
        <nav className="rail-nav" aria-label="Hauptnavigation">
          <NavLink to="/chats" className={navLinkClass} aria-label="Chats">
            <ChatsIcon />
            <span>Chats</span>
          </NavLink>
          <NavLink to="/kontakte" className={navLinkClass} aria-label="Kontakte">
            <ContactsIcon />
            <span>Kontakte</span>
          </NavLink>
          <NavLink to="/profil" className={navLinkClass} aria-label="Profil">
            <ProfileIcon />
            <span>Profil</span>
          </NavLink>
        </nav>
        <div className="rail-spacer" />
        <div className="rail-user-slot">
          {status === 'loading' ? (
            <Skeleton variant="circle" width={40} height={40} />
          ) : user ? (
            <DropdownMenu
              label="Konto-Menü"
              placement="top"
              align="start"
              triggerClassName="rail-user"
              trigger={<Avatar src={avatarUrl} name={user.display_name} size="md" />}
              items={[
                { label: 'Profil öffnen', to: '/profil' },
                { label: 'Abmelden', danger: true, icon: <LogoutIcon />, onSelect: handleLogout },
              ]}
            />
          ) : (
            <Link className="rail-user rail-user--guest" to="/anmelden" aria-label="Anmelden">
              <Avatar name="Gast" size="md" alt="" />
            </Link>
          )}
        </div>
        <div className="rail-legal">
          <Link to="/impressum">Impressum</Link>
          <Link to="/datenschutz">Datenschutz</Link>
        </div>
      </header>
      <main className="app-main">
        <div className="page">{children}</div>
        <footer className="legal-bar">
          <span>OfficeMessenger2 · internes Büro</span>
          <div className="legal-bar__links">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutzerklärung</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
