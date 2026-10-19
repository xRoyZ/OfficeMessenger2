import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import GalleryPage from './dev/GalleryPage';
import { AppShell } from './layout/AppShell';
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';
import ContactsPage from './pages/ContactsPage';
import CreateGroupPage from './pages/CreateGroupPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import LegalPage from './pages/LegalPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import StatusCreatePage from './pages/StatusCreatePage';
import StatusViewerPage from './pages/StatusViewerPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <AppShell>
        <p className="muted" role="status">
          Wird geladen …
        </p>
      </AppShell>
    );
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/anmelden"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="/anmelden" element={<LoginPage />} />
      <Route path="/registrieren" element={<RegisterPage />} />
      <Route
        path="/chats"
        element={
          <RequireAuth>
            <ChatListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chats/:chatId"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/kontakte"
        element={
          <RequireAuth>
            <ContactsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profil"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/gruppen/neu"
        element={
          <RequireAuth>
            <CreateGroupPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gruppen/:chatId/einstellungen"
        element={
          <RequireAuth>
            <GroupSettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/status/neu"
        element={
          <RequireAuth>
            <StatusCreatePage />
          </RequireAuth>
        }
      />
      <Route
        path="/status/:statusId"
        element={
          <RequireAuth>
            <StatusViewerPage />
          </RequireAuth>
        }
      />
      <Route path="/impressum" element={<LegalPage kind="impressum" />} />
      <Route path="/datenschutz" element={<LegalPage kind="datenschutz" />} />
      {import.meta.env.DEV ? <Route path="/dev/kit" element={<GalleryPage />} /> : null}
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
  );
}
