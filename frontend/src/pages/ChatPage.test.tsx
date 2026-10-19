import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatOut, MessageOut, MessagePage, WsEvent } from '../lib/types';
import ChatPage from './ChatPage';

const mocks = vi.hoisted(() => {
  const handlers = new Set<(event: WsEvent) => void>();
  return {
    user: {
      id: 'user-anna',
      display_name: 'Anna Weber',
      status_text: null,
      avatar_url: null,
      email: 'anna@demo.local',
    },
    connectRealtime: vi.fn(),
    disconnectRealtime: vi.fn(),
    subscribe: vi.fn((handler: (event: WsEvent) => void) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }),
    emit: (event: WsEvent) => {
      for (const handler of handlers) {
        handler(event);
      }
    },
    resetHandlers: () => {
      handlers.clear();
    },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
    getAccessToken: vi.fn(() => 'test-token'),
  };
});

vi.mock('../lib/api', () => ({
  api: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    del: mocks.del,
    upload: mocks.upload,
  },
  ApiError: class ApiError extends Error {
    status = 0;
    code = 'error';
  },
  getAccessToken: mocks.getAccessToken,
}));

vi.mock('../lib/realtime', () => ({
  connectRealtime: mocks.connectRealtime,
  disconnectRealtime: mocks.disconnectRealtime,
  subscribe: mocks.subscribe,
}));

vi.mock('../lib/assets', () => ({
  useAuthedBlobUrl: () => null,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    status: 'authenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

const chat: ChatOut = {
  id: 'chat-1',
  kind: 'group',
  title: 'Produkt & Design',
  photo_url: null,
  role: 'member',
  member_count: 3,
  members: [
    {
      user: { id: 'user-anna', display_name: 'Anna Weber', status_text: null, avatar_url: null },
      role: 'admin',
    },
    {
      user: { id: 'user-ben', display_name: 'Ben Osei', status_text: null, avatar_url: null },
      role: 'member',
    },
    {
      user: { id: 'user-clara', display_name: 'Clara Nguyen', status_text: null, avatar_url: null },
      role: 'member',
    },
  ],
  unread_count: 0,
  last_activity_at: '2026-10-19T09:04:00',
  last_message: null,
};

const ben: MessageOut['sender'] = {
  id: 'user-ben',
  display_name: 'Ben Osei',
  status_text: null,
  avatar_url: null,
};

const ownSender: MessageOut['sender'] = {
  id: 'user-anna',
  display_name: 'Anna Weber',
  status_text: null,
  avatar_url: null,
};

function serverMessage(overrides: Partial<MessageOut> = {}): MessageOut {
  return {
    id: 3,
    chat_id: 'chat-1',
    kind: 'text',
    text: 'Bis später',
    sender: ownSender,
    created_at: '2026-10-19T09:04:00',
    is_read: false,
    ...overrides,
  };
}

const initialPage: MessagePage = {
  items: [
    {
      id: 2,
      chat_id: 'chat-1',
      kind: 'text',
      text: 'Morgen Anna, hast du später fünf Minuten?',
      sender: ben,
      created_at: '2026-10-19T09:02:00',
      is_read: false,
    },
    serverMessage(),
  ],
  has_more: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/chats/chat-1']}>
      <Routes>
        <Route path="/chats/:chatId" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setUpApi(page: MessagePage) {
  mocks.get.mockImplementation((path: string) => {
    if (path === '/api/chats/chat-1') {
      return Promise.resolve(chat);
    }
    if (path.startsWith('/api/chats/chat-1/messages')) {
      return Promise.resolve(page);
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
  mocks.post.mockImplementation((path: string) => {
    if (path === '/api/chats/chat-1/read') {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(serverMessage({ id: 10, text: 'Hallo Team' }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetHandlers();
  mocks.getAccessToken.mockReturnValue('test-token');
});

afterEach(() => {
  cleanup();
});

describe('ChatPage', () => {
  it('renders the initial page with sender name, time and avatar', async () => {
    setUpApi(initialPage);
    const { container } = renderPage();

    expect(
      await screen.findByText('Morgen Anna, hast du später fünf Minuten?'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ben Osei').length).toBeGreaterThan(0);
    expect(screen.getByText('09:02')).toBeInTheDocument();
    expect(container.querySelector('.message__avatar')).not.toBeNull();
    expect(mocks.connectRealtime).toHaveBeenCalledWith('test-token');
  });

  it('appends a sent message optimistically', async () => {
    setUpApi(initialPage);
    renderPage();

    await screen.findByText('Morgen Anna, hast du später fünf Minuten?');
    const input = screen.getByPlaceholderText('Nachricht an die Gruppe …');
    const sendButton = screen.getByRole('button', { name: 'Nachricht senden' });

    expect(sendButton).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Hallo Team' } });
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    expect(screen.getByText('Hallo Team')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/api/chats/chat-1/messages', {
        text: 'Hallo Team',
      });
    });
    expect(await screen.findByText('Hallo Team')).toBeInTheDocument();
  });

  it('shows a realtime message without refetching the history', async () => {
    setUpApi(initialPage);
    renderPage();

    await screen.findByText('Morgen Anna, hast du später fünf Minuten?');
    const callsBefore = mocks.get.mock.calls.length;

    mocks.emit({
      type: 'message:new',
      chat_id: 'chat-1',
      message: {
        id: 12,
        chat_id: 'chat-1',
        kind: 'text',
        text: 'Live angekommen',
        sender: {
          id: 'user-clara',
          display_name: 'Clara Nguyen',
          status_text: null,
          avatar_url: null,
        },
        created_at: '2026-10-19T09:06:00',
        is_read: false,
      },
    });

    expect(await screen.findByText('Live angekommen')).toBeInTheDocument();
    expect(mocks.get.mock.calls.length).toBe(callsBefore);
  });

  it('flips the tick when a read event for this chat arrives', async () => {
    setUpApi(initialPage);
    renderPage();

    await screen.findByText('Bis später');
    expect(screen.getByLabelText('Gesendet')).toBeInTheDocument();

    mocks.emit({
      type: 'message:read',
      chat_id: 'chat-1',
      last_read_message_id: 3,
      reader_id: 'user-ben',
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Gelesen')).toBeInTheDocument();
    });
  });

  it('renders system messages as a centered hint instead of a bubble', async () => {
    setUpApi({
      items: [
        {
          id: 1,
          chat_id: 'chat-1',
          kind: 'system',
          text: 'Clara Nguyen wurde zur Gruppe hinzugefügt.',
          sender: null,
          created_at: '2026-10-19T08:40:00',
          is_read: false,
        },
      ],
      has_more: false,
    });

    const { container } = renderPage();

    expect(
      await screen.findByText('Clara Nguyen wurde zur Gruppe hinzugefügt.'),
    ).toBeInTheDocument();
    expect(container.querySelector('.system-note')).not.toBeNull();
    expect(container.querySelector('.message')).toBeNull();
  });

  it('marks the newest message as read after it is visible', async () => {
    setUpApi(initialPage);
    renderPage();

    await screen.findByText('Bis später');

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/api/chats/chat-1/read', {
        last_message_id: 3,
      });
    });
  });

  it('prepends older messages when scrolled to the top', async () => {
    setUpApi({
      items: [
        serverMessage({
          id: 5,
          text: 'Neuere Nachricht',
          created_at: '2026-10-19T09:10:00',
        }),
      ],
      has_more: true,
    });

    mocks.get.mockImplementation((path: string) => {
      if (path === '/api/chats/chat-1') {
        return Promise.resolve(chat);
      }
      if (path === '/api/chats/chat-1/messages?before=5&limit=30') {
        return Promise.resolve({
          items: [
            serverMessage({
              id: 4,
              text: 'Ältere Nachricht',
              created_at: '2026-10-19T08:50:00',
            }),
          ],
          has_more: false,
        });
      }
      if (path.startsWith('/api/chats/chat-1/messages')) {
        return Promise.resolve({
          items: [
            serverMessage({
              id: 5,
              text: 'Neuere Nachricht',
              created_at: '2026-10-19T09:10:00',
            }),
          ],
          has_more: true,
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });

    renderPage();
    await screen.findByText('Neuere Nachricht');

    fireEvent.scroll(screen.getByTestId('message-thread'), { target: { scrollTop: 0 } });

    expect(await screen.findByText('Ältere Nachricht')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/api/chats/chat-1/messages?before=5&limit=30');
  });
});
