import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import type { StatusGroupOut } from '../../lib/types';
import { StatusStrip } from './StatusStrip';

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

const anna: StatusGroupOut['user'] = {
  id: 'user-anna',
  display_name: 'Anna Weber',
  status_text: null,
  avatar_url: null,
};

const clara: StatusGroupOut['user'] = {
  id: 'user-clara',
  display_name: 'Clara Nguyen',
  status_text: null,
  avatar_url: null,
};

function group(overrides: Partial<StatusGroupOut> & Pick<StatusGroupOut, 'user'>): StatusGroupOut {
  return {
    items: [
      {
        id: `status-${overrides.user.id}`,
        image_url: `/api/files/${overrides.user.id}`,
        caption: null,
        created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
        expires_at: new Date(Date.now() + 20 * 3_600_000).toISOString(),
        seen: false,
        viewer_count: 0,
      },
    ],
    has_unseen: true,
    is_own: false,
    ...overrides,
  };
}

function renderStrip(onOpen = vi.fn()) {
  return render(
    <MemoryRouter>
      <StatusStrip onOpen={onOpen} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('StatusStrip', () => {
  it('shows the own entry first with its add control linking to the composer', async () => {
    apiMock.get.mockResolvedValue([group({ user: anna, is_own: true, has_unseen: false })]);
    const onOpen = vi.fn();

    renderStrip(onOpen);

    expect(await screen.findByText('Mein Status')).toBeInTheDocument();
    const addControl = screen.getByRole('link', { name: 'Eigenen Status hinzufügen' });
    expect(addControl).toHaveAttribute('href', '/status/neu');

    const ownRing = screen.getByRole('button', { name: 'Eigenen Status ansehen' });
    ownRing.click();
    expect(onOpen).toHaveBeenCalledWith('user-anna');
    expect(apiMock.get).toHaveBeenCalledWith('/api/status');
  });

  it('marks a ring as unseen while has_unseen is true and as seen afterwards', async () => {
    apiMock.get.mockResolvedValue([group({ user: clara, has_unseen: true })]);
    const onOpen = vi.fn();
    const { unmount } = renderStrip(onOpen);

    const unseenRing = await screen.findByRole('button', {
      name: 'Status von Clara Nguyen ansehen',
    });
    expect(unseenRing).not.toHaveClass('is-seen');

    unseenRing.click();
    expect(onOpen).toHaveBeenCalledWith('user-clara');

    unmount();
    apiMock.get.mockResolvedValue([group({ user: clara, has_unseen: false })]);
    renderStrip(onOpen);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Status von Clara Nguyen ansehen' }),
      ).toHaveClass('is-seen');
    });
  });
});
