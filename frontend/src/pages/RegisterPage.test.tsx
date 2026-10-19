import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import type { AuthOut, MeOut } from '../lib/types';
import RegisterPage from './RegisterPage';

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

const newUser: MeOut = {
  id: '22222222-2222-2222-2222-222222222222',
  display_name: 'Jonas Berger',
  status_text: null,
  avatar_url: null,
  email: 'jonas@demo.local',
};

const authResult: AuthOut = {
  access_token: 'test-token',
  token_type: 'bearer',
  user: newUser,
};

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/registrieren']}>
      <AuthProvider>
        <Routes>
          <Route path="/registrieren" element={<RegisterPage />} />
          <Route path="/chats" element={<h1>Chatliste</h1>} />
          <Route path="/anmelden" element={<h1>Anmeldung</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fillForm(
  displayName = 'Jonas Berger',
  email = 'jonas@demo.local',
  password = 'Demo1234!',
) {
  fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: displayName } });
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

describe('RegisterPage', () => {
  it('starts neutral without validation messages', () => {
    renderRegister();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Konto erstellen und anmelden' }),
    ).toBeInTheDocument();
  });

  it('shows field errors when submitting an empty form', () => {
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen und anmelden' }));

    expect(screen.getByText('Bitte gib deinen Anzeigenamen ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte gib ein Passwort ein.')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('clears the password error once the password is long enough', () => {
    renderRegister();

    const passwordInput = screen.getByLabelText('Passwort');
    fireEvent.change(passwordInput, { target: { value: 'kurz' } });
    fireEvent.blur(passwordInput);
    expect(
      screen.getByText('Das Passwort muss mindestens 8 Zeichen lang sein.'),
    ).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: 'lang-genug' } });
    expect(
      screen.queryByText('Das Passwort muss mindestens 8 Zeichen lang sein.'),
    ).not.toBeInTheDocument();
  });

  it('shows a taken e-mail as a message at the form', async () => {
    postMock.mockRejectedValueOnce(
      new ApiError(409, 'email_taken', 'Diese E-Mail-Adresse ist bereits vergeben.'),
    );
    renderRegister();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen und anmelden' }));

    expect(
      await screen.findByText('Diese E-Mail-Adresse ist bereits vergeben.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveValue('jonas@demo.local');
  });

  it('navigates to the chat list after registering', async () => {
    postMock.mockResolvedValueOnce(authResult);
    renderRegister();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen und anmelden' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chatliste' })).toBeInTheDocument();
    });
    expect(postMock).toHaveBeenCalledWith('/api/auth/register', {
      email: 'jonas@demo.local',
      display_name: 'Jonas Berger',
      password: 'Demo1234!',
    });
  });

  it('links back to the sign-in screen', () => {
    renderRegister();

    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute(
      'href',
      '/anmelden',
    );
  });
});
