import { AppShell } from '../layout/AppShell';

export default function LoginPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Willkommen zurück</div>
          <h1>Anmelden</h1>
          <p className="page-subtitle">Die Anmeldung wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
