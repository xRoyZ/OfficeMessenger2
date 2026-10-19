import { AppShell } from '../layout/AppShell';

export default function StatusCreatePage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Status · 24 Stunden</div>
          <h1>Neuer Status</h1>
          <p className="page-subtitle">Das Posten eines Status wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
