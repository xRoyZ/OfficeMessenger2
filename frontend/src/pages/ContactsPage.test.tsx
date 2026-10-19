import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import type { ChatOut, UserOut } from '../lib/types';
import { AuthProvider } from '../context/AuthContext';
import ContactsPage from './ContactsPage';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: getMock,
      post: postMock,
    },
  };
});

const ben: UserOut = {
  id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Ben Osei',
  status_text: 'Engineering · Baut kleine Dinge, die groß wirken.',
  avatar_url: null,
};

const clara: UserOut = {
  id: '22222222-2222-2222-2222-222222222222',
  display_name: 'Clara Nguyen',
  status_text: 'Brand & Content · Worte, die bleiben.',
  avatar_url: null,
};

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderContacts() {
  return render(
    <MemoryRouter initialEntries={['/kontakte']}>
      <AuthProvider>
        <Routes>
          <Route path="/kontakte" element={<ContactsPage />} />
          <Route path="/chats/:chatId" element={<LocationDisplay />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  getMock.mockImplementation((path: string) =>
    Promise.resolve(path.includes('search=ben') ? [ben] : [ben, clara]),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ContactsPage', () => {
  it('renders every user from the directory with name and status text', async () => {
    renderContacts();

    expect(await screen.findByText('Ben Osei')).toBeInTheDocument();
    expect(screen.getByText('Clara Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Engineering · Baut kleine Dinge, die groß wirken.')).toBeInTheDocument();
    expect(screen.getByText('Brand & Content · Worte, die bleiben.')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('/api/users');
  });

  it('filters the directory through a new request when the user types', async () => {
    renderContacts();

    await screen.findByText('Clara Nguyen');

    fireEvent.change(screen.getByLabelText('Kontakte nach Namen durchsuchen'), {
      target: { value: 'ben' },
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/api/users?search=ben');
    });

    await waitFor(() => {
      expect(screen.queryByText('Clara Nguyen')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Ben Osei')).toBeInTheDocument();
    expect(screen.getByText('1 Treffer')).toBeInTheDocument();
  });

  it('opens the direct chat when a contact is clicked', async () => {
    postMock.mockResolvedValue({ id: 'chat-ben' } as ChatOut);

    renderContacts();

    const name = await screen.findByText('Ben Osei');
    fireEvent.click(name.closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/chats/direct', { user_id: ben.id });
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/chats/chat-ben');
    });
  });

  it('shows the German error message in a banner when opening a chat fails', async () => {
    postMock.mockRejectedValue(
      new ApiError(404, 'user_not_found', 'Nutzer nicht gefunden.'),
    );

    renderContacts();

    const name = await screen.findByText('Ben Osei');
    fireEvent.click(name.closest('button') as HTMLButtonElement);

    expect(await screen.findByRole('alert')).toHaveTextContent('Nutzer nicht gefunden.');
  });

  it('shows the empty state when no user matches the search', async () => {
    getMock.mockImplementation(() => Promise.resolve([]));

    renderContacts();

    expect(await screen.findByText('Keine Person gefunden')).toBeInTheDocument();
    expect(
      screen.getByText('Versuche es mit einem anderen Namen oder einem Teil des Namens.'),
    ).toBeInTheDocument();
  });
});
