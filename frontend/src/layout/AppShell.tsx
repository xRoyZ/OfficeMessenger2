import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
}

export function AppShell({ children, header }: AppShellProps) {
  const hasHeader = header !== null && header !== undefined;

  return (
    <div className={hasHeader ? 'app' : 'app app--no-nav'}>
      <header className="rail" aria-label="App-Navigation">
        <Link className="brandmark" to="/chats" aria-label="OfficeMessenger2">
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
        </Link>
        {header}
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
