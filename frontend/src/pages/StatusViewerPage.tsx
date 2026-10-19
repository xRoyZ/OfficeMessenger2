import { AppShell } from '../layout/AppShell';

export default function StatusViewerPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Status · 24 Stunden</div>
          <h1>Status</h1>
          <p className="page-subtitle">Die Statusansicht wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
