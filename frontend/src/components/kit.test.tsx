import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { AuthProvider, useAuth } from '../context/AuthContext';
import GalleryPage from '../dev/GalleryPage';

function renderGallery() {
  return render(
    <MemoryRouter initialEntries={['/dev/kit']}>
      <AuthProvider>
        <GalleryPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function SignInForTest({ children }: { children: ReactNode }) {
  const { setUser } = useAuth();

  useEffect(() => {
    setUser({
      id: '11111111-1111-1111-1111-111111111111',
      display_name: 'Anna Weber',
      status_text: null,
      avatar_url: null,
      email: 'anna@demo.local',
    });
  }, [setUser]);

  return <>{children}</>;
}

function renderSignedInGallery() {
  return render(
    <MemoryRouter initialEntries={['/dev/kit']}>
      <AuthProvider>
        <SignInForTest>
          <GalleryPage />
        </SignInForTest>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('UI kit gallery', () => {
  it('is reachable through the dev-only kit route', () => {
    render(
      <MemoryRouter initialEntries={['/dev/kit']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'UI-Kit' })).toBeInTheDocument();
  });

  it('renders the app navigation chrome from the kit', () => {
    renderGallery();

    const navigation = screen.getByRole('banner', { name: 'App-Navigation' });
    expect(within(navigation).getByRole('link', { name: 'Chats' })).toHaveAttribute(
      'href',
      '/chats',
    );
    expect(within(navigation).getByRole('link', { name: 'Kontakte' })).toHaveAttribute(
      'href',
      '/kontakte',
    );
    expect(within(navigation).getByRole('link', { name: 'Profil' })).toHaveAttribute(
      'href',
      '/profil',
    );
    expect(screen.getByRole('heading', { name: 'UI-Kit' })).toBeInTheDocument();
  });

  it('shows the sign-out control in the chrome for a signed-in user', async () => {
    renderSignedInGallery();

    const menuTrigger = await screen.findByRole('button', { name: 'Konto-Menü' });
    fireEvent.click(menuTrigger);

    const menu = await screen.findByRole('menu', { name: 'Konto-Menü' });
    expect(within(menu).getByRole('menuitem', { name: 'Profil öffnen' })).toHaveAttribute(
      'href',
      '/profil',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Abmelden' })).toBeInTheDocument();
  });

  it('renders buttons in idle, disabled and loading states', () => {
    renderGallery();

    expect(screen.getByRole('button', { name: 'Primär' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Akzent' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gefahr' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Deaktiviert' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mehr Optionen' })).toBeInTheDocument();

    const loading = screen.getByRole('button', { name: 'Speichern' });
    expect(loading).toBeDisabled();
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });

  it('renders text, password and textarea fields with hint and error states', () => {
    renderGallery();

    const nameField = screen.getByRole('textbox', { name: 'Anzeigename' });
    expect(nameField).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('So erscheinst du im Team.')).toBeInTheDocument();

    const emailField = screen.getByRole('textbox', { name: 'E-Mail-Adresse' });
    expect(emailField).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Bitte gib eine gültige E-Mail-Adresse ein.'),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Passwort')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('textbox', { name: 'Statustext' })).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Chats und Kontakte suchen' }),
    ).toBeInTheDocument();
  });

  it('renders avatar sizes, badges and unread counts', () => {
    renderGallery();

    expect(screen.getAllByRole('img', { name: 'Anna Weber' }).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Ausstehend')).toBeInTheDocument();
    expect(screen.getByText('Gelöscht')).toBeInTheDocument();
    expect(screen.getByLabelText('130 ungelesene Nachrichten')).toHaveTextContent('99+');
  });

  it('renders filter chips in idle and selected states and switches selection', () => {
    renderGallery();

    const all = screen.getByRole('button', { name: /Alle/ });
    const groups = screen.getByRole('button', { name: /Gruppen/ });

    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(groups).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(groups);

    expect(groups).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders chat rows, contact cards and list rows', () => {
    renderGallery();

    expect(
      screen.getByRole('link', { name: /Produkt & Design/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ben Osei/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Clara Nguyen/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Greta Sommer/ })).toBeInTheDocument();
    expect(screen.getByText('QA · nicht verfügbar')).toBeInTheDocument();
  });

  it('renders banners, empty state, spinner and skeleton states', () => {
    const { container } = renderGallery();

    expect(
      screen.getByText('Bitte prüfe deine Angaben und versuche es erneut.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Profil gespeichert. Dein Team sieht die Änderung sofort.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nichts gefunden' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(5);
  });

  it('opens and closes the dialog', async () => {
    renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'Dialog öffnen' }));

    const dialog = await screen.findByRole('dialog', { name: 'Konto löschen?' });
    expect(
      within(dialog).getByText('Diese Aktion kann nicht rückgängig gemacht werden.'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog', { name: 'Konto löschen?' })).not.toBeInTheDocument();
  });

  it('opens the dropdown menu and reports the selected action', async () => {
    renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'Kit-Menü' }));

    const menu = await screen.findByRole('menu', { name: 'Kit-Menü' });
    expect(within(menu).getByRole('menuitem', { name: 'Demnächst' })).toBeDisabled();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Profil öffnen' }));

    expect(screen.getByText('Menüaktion ausgelöst: Profil öffnen')).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Kit-Menü' })).not.toBeInTheDocument();
  });
});
