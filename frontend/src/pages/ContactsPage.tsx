import { AppShell } from '../layout/AppShell';

export default function ContactsPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Menschen im Messenger</div>
          <h1>Kontakte</h1>
          <p className="page-subtitle">Das Kontaktverzeichnis wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
