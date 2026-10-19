import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import type { AuthOut, MeOut } from '../lib/types';
import LoginPage from './LoginPage';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock, post: postMock },
  };
});

const demoUser: MeOut = {
  id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Anna Weber',
  status_text: null,
  avatar_url: null,
  email: 'anna@demo.local',
};

const authResult: AuthOut = {
  access_token: 'test-token',
  token_type: 'bearer',
  user: demoUser,
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/anmelden']}>
      <AuthProvider>
        <Routes>
          <Route path="/anmelden" element={<LoginPage />} />
          <Route path="/chats" element={<h1>Chatliste</h1>} />
          <Route path="/registrieren" element={<h1>Registrierung</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fillCredentials(email = 'anna@demo.local', password = 'Demo1234!') {
  fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: password } });
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('LoginPage', () => {
  it('starts neutral without validation messages', () => {
    renderLogin();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
  });

  it('shows field errors when submitting an empty form', () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the value is valid again', () => {
    renderLogin();

    const emailInput = screen.getByLabelText('E-Mail-Adresse');
    fireEvent.blur(emailInput);
    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'anna@demo.local' } });
    expect(screen.queryByText('Bitte gib deine E-Mail-Adresse ein.')).not.toBeInTheDocument();
  });

  it('shows one general message for an invalid login and keeps the e-mail', async () => {
    postMock.mockRejectedValueOnce(
      new ApiError(401, 'invalid_credentials', 'E-Mail-Adresse oder Passwort ist falsch.'),
    );
    renderLogin();

    fillCredentials('anna@demo.local', 'falsches-passwort');
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(
      await screen.findByText('Anmeldung fehlgeschlagen. Bitte prüfe deine Zugangsdaten.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveValue('anna@demo.local');
    expect(screen.getByLabelText('Passwort')).toHaveValue('');
    expect(screen.queryByText('E-Mail-Adresse oder Passwort ist falsch.')).not.toBeInTheDocument();
  });

  it('navigates to the chat list after a successful login', async () => {
    postMock.mockResolvedValueOnce(authResult);
    renderLogin();

    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chatliste' })).toBeInTheDocument();
    });
    expect(postMock).toHaveBeenCalledWith('/api/auth/login', {
      email: 'anna@demo.local',
      password: 'Demo1234!',
    });
  });

  it('sends an authenticated visitor landing on the sign-in screen to the chats', async () => {
    window.localStorage.setItem('officemessenger.access_token', 'restored-token');
    getMock.mockResolvedValueOnce(demoUser);
    renderLogin();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chatliste' })).toBeInTheDocument();
    });
    expect(getMock).toHaveBeenCalledWith('/api/auth/me');
  });

  it('links to the registration screen', () => {
    renderLogin();

    expect(screen.getByRole('link', { name: 'Konto erstellen' })).toHaveAttribute(
      'href',
      '/registrieren',
    );
  });
});
