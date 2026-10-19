import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import type { StatusGroupOut, ViewerOut } from '../../lib/types';
import { StatusViewer } from './StatusViewer';

vi.mock('../../lib/api', () => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  return {
    ApiError,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      del: vi.fn(),
      upload: vi.fn(),
    },
  };
});

const apiMock = vi.mocked(api);

const clara: StatusGroupOut['user'] = {
  id: 'user-clara',
  display_name: 'Clara Nguyen',
  status_text: null,
  avatar_url: null,
};

const anna: StatusGroupOut['user'] = {
  id: 'user-anna',
  display_name: 'Anna Weber',
  status_text: null,
  avatar_url: null,
};

function statusItem(id: string, caption: string | null) {
  return {
    id,
    image_url: `/api/files/${id}`,
    caption,
    created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    expires_at: new Date(Date.now() + 23 * 3_600_000).toISOString(),
    seen: false,
    viewer_count: 0,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderViewer(statusId: string) {
  return render(
    <MemoryRouter initialEntries={[`/status/${statusId}`]}>
      <StatusViewer statusId={statusId} />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.post.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('StatusViewer', () => {
  it('posts the view for the visible item and advances on tap', async () => {
    const groups: StatusGroupOut[] = [
      {
        user: clara,
        items: [statusItem('status-one', 'Erster Status'), statusItem('status-two', 'Zweiter Status')],
        has_unseen: true,
        is_own: false,
      },
    ];
    apiMock.get.mockResolvedValue(groups);

    renderViewer('user-clara');

    expect(await screen.findByRole('heading', { name: 'Erster Status' })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/status/status-one/view');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Status' }));

    expect(await screen.findByRole('heading', { name: 'Zweiter Status' })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/status/status-two/view');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Status' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/chats');
    });
  });

  it('advances on a tap on the stage', async () => {
    apiMock.get.mockResolvedValue([
      {
        user: clara,
        items: [statusItem('status-one', 'Erster Status'), statusItem('status-two', 'Zweiter Status')],
        has_unseen: true,
        is_own: false,
      },
    ]);

    renderViewer('user-clara');

    expect(await screen.findByRole('heading', { name: 'Erster Status' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Statusanzeige'));
    expect(await screen.findByRole('heading', { name: 'Zweiter Status' })).toBeInTheDocument();
  });

  it('lists the viewers with their viewing time for the own status', async () => {
    const ownGroup: StatusGroupOut = {
      user: anna,
      items: [statusItem('status-own', 'Mein Status')],
      has_unseen: false,
      is_own: true,
    };
    const viewers: ViewerOut[] = [
      {
        user: {
          id: 'user-ben',
          display_name: 'Ben Osei',
          status_text: null,
          avatar_url: null,
        },
        viewed_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    ];
    apiMock.get.mockImplementation((path: string) => {
      if (path === '/api/status') {
        return Promise.resolve([ownGroup]);
      }
      if (path === '/api/status/status-own/viewers') {
        return Promise.resolve(viewers);
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderViewer('user-anna');

    expect(await screen.findByText('Betrachter')).toBeInTheDocument();
    expect(await screen.findByText('Ben Osei')).toBeInTheDocument();
    expect(screen.getAllByText(/^vor \d+ Min\.$/).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/status/status-own/view');
    });
  });
});
