import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import type { ChatOut, UserOut } from '../lib/types';
import CreateGroupPage from './CreateGroupPage';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      del: vi.fn(),
      upload: vi.fn(),
    },
  };
});

vi.mock('../lib/assets', () => ({
  useAuthedBlobUrl: () => null,
}));

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({
    user: {
      id: 'u-anna',
      display_name: 'Anna Weber',
      status_text: null,
      avatar_url: null,
      email: 'anna@demo.local',
    },
    status: 'authenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

const ben: UserOut = {
  id: 'u-ben',
  display_name: 'Ben Osei',
  status_text: 'Engineering',
  avatar_url: null,
};

const clara: UserOut = {
  id: 'u-clara',
  display_name: 'Clara Nguyen',
  status_text: 'Brand & Content',
  avatar_url: null,
};

const createdChat: ChatOut = {
  id: 'chat-1',
  kind: 'group',
  title: 'Design-Review',
  photo_url: null,
  role: 'admin',
  member_count: 2,
  members: [
    {
      user: {
        id: 'u-anna',
        display_name: 'Anna Weber',
        status_text: null,
        avatar_url: null,
      },
      role: 'admin',
    },
    { user: ben, role: 'member' },
  ],
  unread_count: 0,
  last_activity_at: null,
  last_message: null,
};

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/gruppen/neu']}>
      <Routes>
        <Route path="/gruppen/neu" element={<CreateGroupPage />} />
        <Route path="/chats/:chatId" element={<LocationDisplay />} />
        <Route path="/chats" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue([ben, clara]);
});

afterEach(() => {
  cleanup();
});

describe('CreateGroupPage', () => {
  it('starts neutral without validation messages', async () => {
    renderPage();

    expect(await screen.findByText('Ben Osei')).toBeInTheDocument();
    expect(screen.queryByText('Bitte gib der Gruppe einen Namen.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Wähle mindestens eine Person für die Gruppe aus.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows validation messages after an empty submit', async () => {
    renderPage();
    await screen.findByText('Ben Osei');

    fireEvent.click(screen.getByRole('button', { name: 'Gruppe erstellen' }));

    expect(await screen.findByText('Bitte gib der Gruppe einen Namen.')).toBeInTheDocument();
    expect(
      screen.getByText('Wähle mindestens eine Person für die Gruppe aus.'),
    ).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('creates a group with one member and navigates to its chat', async () => {
    postMock.mockResolvedValue(createdChat);
    renderPage();

    fireEvent.change(await screen.findByLabelText('Gruppenname'), {
      target: { value: 'Design-Review' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Ben Osei/ }));

    expect(screen.getByText('1 ausgewählt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe erstellen' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/groups', {
        name: 'Design-Review',
        member_ids: ['u-ben'],
      });
    });

    expect(await screen.findByTestId('location')).toHaveTextContent('/chats/chat-1');
  });

  it('searches the directory through the users endpoint', async () => {
    renderPage();
    await screen.findByText('Ben Osei');

    fireEvent.change(screen.getByLabelText('Personen durchsuchen'), {
      target: { value: 'Ben' },
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/api/users?search=Ben');
    });
  });
});
