import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../lib/api';
import type { ChatMemberOut, ChatOut, UserOut } from '../lib/types';
import GroupSettingsPage from './GroupSettingsPage';

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

const authState = vi.hoisted(() => ({
  user: {
    id: 'u-anna',
    display_name: 'Anna Weber',
    status_text: null as string | null,
    avatar_url: null as string | null,
    email: 'anna@demo.local',
  },
}));

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({
    user: authState.user,
    status: 'authenticated',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

const anna: UserOut = {
  id: 'u-anna',
  display_name: 'Anna Weber',
  status_text: null,
  avatar_url: null,
};

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

const david: UserOut = {
  id: 'u-david',
  display_name: 'David Klein',
  status_text: 'Operations',
  avatar_url: null,
};

function groupChat(overrides: Partial<ChatOut> = {}): ChatOut {
  const members: ChatMemberOut[] = [
    { user: anna, role: 'admin' },
    { user: ben, role: 'admin' },
    { user: clara, role: 'member' },
  ];

  return {
    id: 'chat-1',
    kind: 'group',
    title: 'Produkt & Design',
    photo_url: null,
    role: 'admin',
    member_count: members.length,
    members,
    unread_count: 0,
    last_activity_at: null,
    last_message: null,
    ...overrides,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/gruppen/chat-1/einstellungen']}>
      <Routes>
        <Route path="/gruppen/:chatId/einstellungen" element={<GroupSettingsPage />} />
        <Route path="/chats" element={<LocationDisplay />} />
        <Route path="/chats/:chatId" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);
const delMock = vi.mocked(api.del);
const uploadMock = vi.mocked(api.upload);

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(groupChat());
});

afterEach(() => {
  cleanup();
});

describe('GroupSettingsPage as admin', () => {
  it('renames, promotes, demotes and removes members through their routes', async () => {
    patchMock.mockResolvedValue(groupChat({ title: 'Neues Design' }));
    postMock.mockResolvedValue(groupChat());
    delMock.mockResolvedValue(groupChat());

    renderPage();

    const nameInput = await screen.findByLabelText('Gruppenname');
    fireEvent.change(nameInput, { target: { value: 'Neues Design' } });
    fireEvent.click(screen.getByRole('button', { name: 'Namen speichern' }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/api/groups/chat-1', { name: 'Neues Design' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Zum Admin machen' }));
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/groups/chat-1/admins', {
        user_id: 'u-clara',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Admin entziehen' }));
    await waitFor(() => {
      expect(delMock).toHaveBeenCalledWith('/api/groups/chat-1/admins/u-ben');
    });

    const claraRow = screen.getByText('Clara Nguyen').closest('tr');
    expect(claraRow).not.toBeNull();
    fireEvent.click(within(claraRow as HTMLElement).getByRole('button', { name: 'Entfernen' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mitglied entfernen' }));

    await waitFor(() => {
      expect(delMock).toHaveBeenCalledWith('/api/groups/chat-1/members/u-clara');
    });
  });

  it('adds a member from the directory and replaces the group photo', async () => {
    const updated = groupChat();
    updated.members = [
      ...updated.members,
      { user: david, role: 'member' },
    ];
    updated.member_count = updated.members.length;
    getMock.mockImplementation((path: string) => {
      if (path === '/api/users') {
        return Promise.resolve([david, anna, ben, clara]);
      }
      return Promise.resolve(groupChat());
    });
    postMock.mockResolvedValue(updated);
    uploadMock.mockResolvedValue(groupChat());

    const file = new File(['image'], 'group.png', { type: 'image/png' });
    const { container } = renderPage();

    await screen.findByLabelText('Gruppenname');
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith('/api/groups/chat-1/photo', file);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Mitglied hinzufügen' })[0]);
    fireEvent.click(await screen.findByRole('checkbox', { name: /David Klein/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/groups/chat-1/members', {
        user_id: 'u-david',
      });
    });
  });

  it('keeps the last admin in place and shows the server message', async () => {
    const message =
      'Die letzte Admin-Person kann die Gruppe nicht verlassen oder sich selbst degradieren. Benenne zuerst eine andere Person zur Admin-Person.';
    getMock.mockResolvedValue(
      groupChat({
        members: [{ user: anna, role: 'admin' }],
        member_count: 1,
      }),
    );
    delMock.mockRejectedValue(new ApiError(400, 'last_admin', message));

    renderPage();

    await screen.findByRole('button', { name: 'Admin-Rechte abgeben' });
    fireEvent.click(screen.getByRole('button', { name: 'Admin-Rechte abgeben' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deine Mitgliedschaft' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gruppeninfo' })).toBeInTheDocument();
    expect(delMock).toHaveBeenCalledWith('/api/groups/chat-1/admins/u-anna');
  });
});

describe('GroupSettingsPage as plain member', () => {
  it('renders the member view without active administration controls and can leave', async () => {
    const memberChat = groupChat({
      role: 'member',
      members: [
        { user: anna, role: 'member' },
        { user: ben, role: 'admin' },
        { user: clara, role: 'member' },
      ],
    });
    getMock.mockResolvedValue(memberChat);
    postMock.mockResolvedValue(undefined);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Deine Mitgliedschaft' })).toBeInTheDocument();
    expect(screen.getByText('Nur Lesen')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Mitglied hinzufügen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zum Admin machen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Admin entziehen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entfernen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Namen speichern' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Gruppenname')).not.toBeInTheDocument();
    expect(screen.queryByText('Foto ändern')).not.toBeInTheDocument();

    const leaveButtons = screen.getAllByRole('button', { name: 'Gruppe verlassen' });
    fireEvent.click(leaveButtons[0]);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gruppe verlassen' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/groups/chat-1/leave');
    });
    expect(await screen.findByTestId('location')).toHaveTextContent('/chats');
  });
});
