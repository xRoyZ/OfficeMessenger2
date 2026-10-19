import { AppShell } from '../layout/AppShell';

export default function ChatListPage() {
  return (
    <AppShell>
      <header className="page-header">
        <div className="page-header__copy">
          <div className="eyebrow">Postfach</div>
          <h1>Chats</h1>
          <p className="page-subtitle">Die Chatliste wird hier ergänzt.</p>
        </div>
      </header>
    </AppShell>
  );
}
