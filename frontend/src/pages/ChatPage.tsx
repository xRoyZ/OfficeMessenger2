import { AppShell } from '../layout/AppShell';

export default function ChatPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Unterhaltung</div>
          <h1>Chat</h1>
          <p className="page-subtitle">Der geöffnete Chat wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
