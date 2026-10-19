import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import type { MeOut } from '../lib/types';
import ProfilePage from './ProfilePage';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
  },
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, api: apiMock };
});

const anna: MeOut = {
  id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Anna Weber',
  status_text: 'Produktdesign bei Nordlicht Studio.',
  avatar_url: null,
  email: 'anna@demo.local',
};

function SignIn({ user, children }: { user: MeOut; children: ReactNode }) {
  const { setUser } = useAuth();

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return <>{children}</>;
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profil']}>
      <AuthProvider>
        <SignIn user={anna}>
          <Routes>
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/anmelden" element={<div>Anmeldeseite</div>} />
          </Routes>
        </SignIn>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.patch.mockReset();
  apiMock.del.mockReset();
  apiMock.upload.mockReset();
  apiMock.get.mockResolvedValue(anna);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ProfilePage', () => {
  it('prefills the form with the signed-in user', async () => {
    renderProfile();

    expect(await screen.findByDisplayValue('Anna Weber')).toBeInTheDocument();
    expect(screen.getByLabelText('Anzeigename')).toHaveValue('Anna Weber');
    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveValue('anna@demo.local');
    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Statustext')).toHaveValue(
      'Produktdesign bei Nordlicht Studio.',
    );
    expect(screen.getByRole('img', { name: 'Aktuelles Profilbild' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Profilbild von Anna Weber' })).toBeInTheDocument();
  });

  it('starts neutral: no validation error before the user interacts', async () => {
    renderProfile();

    await screen.findByDisplayValue('Anna Weber');
    expect(screen.queryByText('Bitte gib einen Anzeigenamen ein.')).not.toBeInTheDocument();
    expect(screen.queryByText('Die Passwörter stimmen nicht überein.')).not.toBeInTheDocument();
  });

  it('saves name and status text and updates the signed-in user', async () => {
    const updated: MeOut = {
      ...anna,
      display_name: 'Anna Schmidt',
      status_text: 'Neuer Statustext.',
    };
    apiMock.patch.mockResolvedValue(updated);

    renderProfile();

    fireEvent.change(await screen.findByLabelText('Anzeigename'), {
      target: { value: 'Anna Schmidt' },
    });
    fireEvent.change(screen.getByLabelText('Statustext'), {
      target: { value: 'Neuer Statustext.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Profil speichern' }));

    await waitFor(() => {
      expect(apiMock.patch).toHaveBeenCalledWith('/api/profile', {
        display_name: 'Anna Schmidt',
        status_text: 'Neuer Statustext.',
      });
    });

    expect(
      await screen.findByText('Profil gespeichert. Deine Änderungen sind für das Team sichtbar.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Anna Schmidt', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Konto · Anna Schmidt')).toBeInTheDocument();
  });

  it('keeps the old avatar and shows a message for an oversized upload', async () => {
    const { container } = renderProfile();

    await screen.findByDisplayValue('Anna Weber');

    const file = new File(['bild'], 'gross.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });

    const input = container.querySelector('#profile-avatar-input');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(
      await screen.findByText('Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.'),
    ).toBeInTheDocument();
    expect(apiMock.upload).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Aktuelles Profilbild' })).toBeInTheDocument();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('uploads a valid avatar and shows the returned image immediately', async () => {
    const updated: MeOut = { ...anna, avatar_url: '/api/files/avatar-new' };
    apiMock.upload.mockResolvedValue(updated);

    const { container } = renderProfile();

    await screen.findByDisplayValue('Anna Weber');

    const file = new File(['bild'], 'bild.png', { type: 'image/png' });
    const input = container.querySelector('#profile-avatar-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(apiMock.upload).toHaveBeenCalledWith('/api/profile/avatar', file);
    });

    expect(screen.getByRole('img', { name: 'Aktuelles Profilbild' })).toBeInTheDocument();
    expect(screen.queryByText('Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.')).not.toBeInTheDocument();
  });

  it('changes the password and reports success', async () => {
    apiMock.post.mockResolvedValue(undefined);

    renderProfile();

    fireEvent.change(await screen.findByLabelText('Aktuelles Passwort'), {
      target: { value: 'Demo1234!' },
    });
    fireEvent.change(screen.getByLabelText('Neues Passwort'), {
      target: { value: 'NeuesPasswort1' },
    });
    fireEvent.change(screen.getByLabelText('Neues Passwort wiederholen'), {
      target: { value: 'NeuesPasswort1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/profile/password', {
        current_password: 'Demo1234!',
        new_password: 'NeuesPasswort1',
      });
    });
    expect(
      await screen.findByText('Passwort geändert. Deine aktuelle Sitzung bleibt bestehen.'),
    ).toBeInTheDocument();
  });

  it('deletes the account through the confirmation dialog and ends the session', async () => {
    window.localStorage.setItem('officemessenger.access_token', 'test-token');
    apiMock.del.mockResolvedValue(undefined);
    apiMock.post.mockResolvedValue(undefined);

    renderProfile();

    await screen.findByDisplayValue('Anna Weber');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));

    const dialog = await screen.findByRole('dialog', { name: 'Konto löschen?' });
    expect(
      within(dialog).getByText('Diese Aktion kann nicht rückgängig gemacht werden.'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Konto endgültig löschen' }));

    await waitFor(() => {
      expect(apiMock.del).toHaveBeenCalledWith('/api/profile');
    });
    expect(await screen.findByText('Anmeldeseite')).toBeInTheDocument();
    expect(window.localStorage.getItem('officemessenger.access_token')).toBeNull();
  });

  it('keeps the dialog open when deletion is rejected', async () => {
    const { ApiError } = await import('../lib/api');
    apiMock.del.mockRejectedValue(new ApiError(500, 'internal_error', 'Löschen fehlgeschlagen.'));

    renderProfile();

    await screen.findByDisplayValue('Anna Weber');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Konto löschen?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Konto endgültig löschen' }));

    expect(await screen.findByText('Löschen fehlgeschlagen.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Konto löschen?' })).toBeInTheDocument();
  });
});
