import { AppShell } from '../layout/AppShell';

export interface LegalPageProps {
  kind: 'impressum' | 'datenschutz';
}

const LEGAL_COPY = {
  impressum: {
    eyebrow: 'Rechtliches · Impressum',
    title: 'Impressum',
  },
  datenschutz: {
    eyebrow: 'Rechtliches · Datenschutz',
    title: 'Datenschutzerklärung',
  },
} as const;

export default function LegalPage({ kind }: LegalPageProps) {
  const copy = LEGAL_COPY[kind];

  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p className="page-subtitle">Die rechtlichen Inhalte werden hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
