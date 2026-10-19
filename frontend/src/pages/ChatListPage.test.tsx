import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../lib/api';
import type { ChatOut, UserOut, WsEvent } from '../lib/types';
import ChatListPage from './ChatListPage';

const realtimeMock = vi.hoisted(() => {
  let handler: ((event: WsEvent) => void) | null = null;

  return {
    subscribe: vi.fn((next: (event: WsEvent) => void) => {
      handler = next;
      return () => {
        if (handler === next) {
          handler = null;
        }
      };
    }),
    emit(event: WsEvent) {
      handler?.(event);
    },
    reset() {
      handler = null;
    },
  };
});

vi.mock('../lib/api', () => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    ApiError,
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
    resolveApiUrl: (path: string) => path,
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
  useAuthedBlobUrl: (path: string | null) => path,
}));

vi.mock('../lib/realtime', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  subscribe: realtimeMock.subscribe,
}));

const apiMock = vi.mocked(api);

function isoAt(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function makeChat(
  overrides: Partial<ChatOut> & Pick<ChatOut, 'id' | 'title' | 'kind'>,
): ChatOut {
  return {
    photo_url: null,
    role: null,
    member_count: 1,
    members: [],
    unread_count: 0,
    last_activity_at: null,
    last_message: null,
    ...overrides,
  };
}

const productChat = makeChat({
  id: 'chat-product',
  kind: 'group',
  title: 'Produkt & Design',
  unread_count: 3,
  last_activity_at: isoAt(9, 42),
  last_message: {
    text: 'Die neuen Screens liegen im Review.',
    sender_display_name: 'Clara Nguyen',
    created_at: isoAt(9, 42),
  },
});

const benChat = makeChat({
  id: 'chat-ben',
  kind: 'direct',
  title: 'Ben Osei',
  unread_count: 2,
  last_activity_at: isoAt(9, 18),
  last_message: {
    text: 'Danke, ich schaue nach dem Call drüber.',
    sender_display_name: 'Ben Osei',
    created_at: isoAt(9, 18),
  },
});

const orgaChat = makeChat({
  id: 'chat-orga',
  kind: 'group',
  title: 'Orga-Team',
  last_activity_at: isoAt(8, 15),
  last_message: {
    text: 'Kurzer Check fürs Offsite?',
    sender_display_name: 'Anna Weber',
    created_at: isoAt(8, 15),
  },
});

const elifChat = makeChat({
  id: 'chat-elif',
  kind: 'direct',
  title: 'Elif Yilmaz',
  unread_count: 1,
  last_activity_at: isoAt(7, 50),
  last_message: {
    text: 'Können wir den Termin auf 14:30 schieben?',
    sender_display_name: 'Elif Yilmaz',
    created_at: isoAt(7, 50),
  },
});

function contactsPathSearch(path: string): string {
  const query = path.split('?')[1] ?? '';
  return new URLSearchParams(query).get('search') ?? '';
}

function mockBackend(chats: ChatOut[], contacts: UserOut[] = []) {
  apiMock.get.mockImplementation((path: string) => {
    if (path === '/api/status') {
      return Promise.resolve([]);
    }

    if (path.startsWith('/api/users')) {
      const term = contactsPathSearch(path).toLocaleLowerCase('de-DE');
      return Promise.resolve(
        contacts.filter((contact) =>
          contact.display_name.toLocaleLowerCase('de-DE').includes(term),
        ),
      );
    }

    if (path.startsWith('/api/chats')) {
      const url = new URL(path, 'http://localhost');
      const filter = url.searchParams.get('filter');
      const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('de-DE');

      let result = chats;
      if (filter === 'unread') {
        result = result.filter((chat) => chat.unread_count > 0);
      } else if (filter === 'groups') {
        result = result.filter((chat) => chat.kind === 'group');
      } else if (filter === 'direct') {
        result = result.filter((chat) => chat.kind === 'direct');
      }
      if (search) {
        result = result.filter((chat) => chat.title.toLocaleLowerCase('de-DE').includes(search));
      }
      return Promise.resolve(result);
    }

    return Promise.resolve([]);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chats']}>
      <AuthProvider>
        <Routes>
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/chats/:chatId" element={<p>Chat geöffnet</p>} />
          <Route path="/status/:statusId" element={<p>Status geöffnet</p>} />
          <Route path="/gruppen/neu" element={<p>Neue Gruppe</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  realtimeMock.subscribe.mockClear();
  realtimeMock.reset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ChatListPage', () => {
  it('renders chats with preview, time and unread counters', async () => {
    mockBackend([productChat, benChat, orgaChat, elifChat]);

    renderPage();

    expect(await screen.findByText('Produkt & Design')).toBeInTheDocument();
    expect(
      screen.getByText('Clara: Die neuen Screens liegen im Review.'),
    ).toBeInTheDocument();
    expect(screen.getByText('09:42')).toBeInTheDocument();
    expect(screen.getByLabelText('6 ungelesene Nachrichten')).toHaveTextContent('6');
    expect(screen.getByLabelText('3 ungelesene Nachrichten')).toHaveTextContent('3');
    expect(screen.getByLabelText('2 ungelesene Nachrichten')).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: 'Neue Gruppe' })).toHaveAttribute(
      'href',
      '/gruppen/neu',
    );
  });

  it('refetches the list with the selected filter when a chip is clicked', async () => {
    mockBackend([productChat, benChat, orgaChat, elifChat]);

    renderPage();
    await screen.findByText('Produkt & Design');

    fireEvent.click(screen.getByRole('button', { name: /Gruppen/ }));

    await waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledWith('/api/chats?filter=groups');
    });

    expect(await screen.findByText('Orga-Team')).toBeInTheDocument();
    expect(screen.queryByText('Ben Osei')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gruppen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('filters chats and contacts while typing in the search field', async () => {
    const benContact: UserOut = {
      id: 'user-ben',
      display_name: 'Ben Osei',
      status_text: 'Engineering',
      avatar_url: null,
    };
    mockBackend([productChat, benChat, orgaChat, elifChat], [benContact]);

    renderPage();
    await screen.findByText('Produkt & Design');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Chats und Kontakte suchen' }), {
      target: { value: 'ben' },
    });

    await waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledWith('/api/chats?filter=all&search=ben');
    });

    expect((await screen.findAllByText('Ben Osei')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Produkt & Design')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat mit Ben Osei öffnen' })).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('opens a direct chat from the contact search results', async () => {
    const benContact: UserOut = {
      id: 'user-ben',
      display_name: 'Ben Osei',
      status_text: null,
      avatar_url: null,
    };
    mockBackend([], [benContact]);
    apiMock.post.mockResolvedValue(
      makeChat({ id: 'chat-direct-ben', kind: 'direct', title: 'Ben Osei' }),
    );

    renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Chats und Kontakte suchen' }), {
      target: { value: 'ben' },
    });

    const contact = await screen.findByRole('button', { name: 'Chat mit Ben Osei öffnen' });
    fireEvent.click(contact);

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/chats/direct', { user_id: 'user-ben' });
    });
    expect(await screen.findByText('Chat geöffnet')).toBeInTheDocument();
  });

  it('reloads the list when a realtime event arrives', async () => {
    const liveChats = [productChat];
    mockBackend(liveChats);

    renderPage();
    await screen.findByText('Produkt & Design');
    expect(screen.queryByText('Ben Osei')).not.toBeInTheDocument();

    liveChats.push(benChat);

    act(() => {
      realtimeMock.emit({ type: 'message:new', chat_id: 'chat-product', message: {
        id: 21,
        chat_id: 'chat-product',
        kind: 'text',
        text: 'Neue Nachricht',
        sender: null,
        created_at: isoAt(10, 0),
        is_read: false,
      } });
    });

    expect(await screen.findByText('Ben Osei')).toBeInTheDocument();
  });
});
