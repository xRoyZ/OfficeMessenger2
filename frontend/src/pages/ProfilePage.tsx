import { AppShell } from '../layout/AppShell';

export default function ProfilePage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Konto</div>
          <h1>Profil</h1>
          <p className="page-subtitle">Das Profil wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
