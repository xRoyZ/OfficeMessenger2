import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components';
import '../styles/auth.css';

export interface AuthPreviewContent {
  avatarName: string;
  name: string;
  meta: string;
  incoming: string;
  outgoing: string;
}

export interface AuthBrandContent {
  eyebrow: string;
  title: string;
  text: string;
  preview: AuthPreviewContent;
}

export interface AuthPanelContent {
  eyebrow: string;
  title: string;
  text: string;
}

export interface AuthLayoutProps {
  brand: AuthBrandContent;
  panel: AuthPanelContent;
  form: ReactNode;
  afterForm?: ReactNode;
  switchPrompt: ReactNode;
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

function Brand() {
  return (
    <div className="auth-brand__top">
      <Link className="brandmark" to="/anmelden" aria-label="OfficeMessenger2 Startseite">
        <Brandmark />
      </Link>
      <div>
        <div className="brand-word">
          OfficeMessenger <sup>2</sup>
        </div>
        <div className="eyebrow" style={{ marginTop: 3 }}>
          Intern. Direkt. Nah.
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({ brand, panel, form, afterForm, switchPrompt }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-label="OfficeMessenger2">
        <Brand />

        <div className="auth-brand__copy">
          <div className="eyebrow">{brand.eyebrow}</div>
          <h1>{brand.title}</h1>
          <p>{brand.text}</p>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview__head">
              <Avatar name={brand.preview.avatarName} size="sm" alt="" />
              <div>
                <div className="auth-preview__name">{brand.preview.name}</div>
                <div className="auth-preview__meta">{brand.preview.meta}</div>
              </div>
            </div>
            <div className="auth-preview__bubble">{brand.preview.incoming}</div>
            <div className="auth-preview__bubble auth-preview__bubble--out">
              {brand.preview.outgoing}
            </div>
          </div>
        </div>

        <div className="auth-brand__foot">
          <span>OfficeMessenger2 · für Nordlicht Studio</span>
          <div className="auth-brand__foot-links">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel__inner">
          <div className="auth-panel__mobile-brand">
            <span className="brandmark">
              <Brandmark />
            </span>
            <div className="brand-word">
              OfficeMessenger <sup>2</sup>
            </div>
          </div>

          <header className="auth-panel__head">
            <div className="eyebrow">{panel.eyebrow}</div>
            <h2>{panel.title}</h2>
            <p>{panel.text}</p>
          </header>

          {form}

          {afterForm}

          <p className="auth-switch">{switchPrompt}</p>

          <div className="auth-legal">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutzerklärung</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
