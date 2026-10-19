import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ApiError, api } from '../lib/api';
import StatusCreatePage from './StatusCreatePage';

vi.mock('../lib/api', () => {
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
    getAccessToken: vi.fn(() => null),
    setAccessToken: vi.fn(),
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

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/status/neu']}>
      <AuthProvider>
        <Routes>
          <Route path="/status/neu" element={<StatusCreatePage />} />
          <Route path="/chats" element={<div>Chatliste</div>} />
        </Routes>
        <LocationDisplay />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function imageFile(name = 'moment.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type });
}

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText(/Bild auswählen/), {
    target: { files: [file] },
  });
}

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('StatusCreatePage', () => {
  it('starts neutral without a preview image or validation message', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Neuer Status' })).toBeInTheDocument();
    expect(screen.getByText('Bild auswählen')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bildunterschrift/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status teilen' })).toBeInTheDocument();
    expect(screen.queryByAltText('Vorschau des Statusbilds')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Bitte wähle zuerst ein Bild für deinen Status.'),
    ).not.toBeInTheDocument();
  });

  it('shows a local preview after the user picks a file', async () => {
    renderPage();

    pickFile(imageFile());

    expect(await screen.findByAltText('Vorschau des Statusbilds')).toHaveAttribute(
      'src',
      'blob:preview',
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('posts the file and caption to the status route and leaves the screen', async () => {
    apiMock.upload.mockResolvedValue({
      id: 'status-1',
      image_url: '/api/files/file-1',
      caption: 'Fokusmodus',
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      seen: false,
      viewer_count: 0,
    });
    renderPage();

    const file = imageFile();
    pickFile(file);
    fireEvent.change(screen.getByLabelText(/Bildunterschrift/), {
      target: { value: 'Fokusmodus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Status teilen' }));

    await waitFor(() => {
      expect(apiMock.upload).toHaveBeenCalledWith('/api/status', file, {
        caption: 'Fokusmodus',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/chats');
    });
  });

  it('shows the missing-image message after submitting without a file', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Status teilen' }));

    expect(
      screen.getByText('Bitte wähle zuerst ein Bild für deinen Status.'),
    ).toBeInTheDocument();
    expect(apiMock.upload).not.toHaveBeenCalled();
  });

  it('shows the German API message when the upload is rejected', async () => {
    apiMock.upload.mockRejectedValue(
      new ApiError(400, 'invalid_upload', 'Nur JPEG-, PNG- und WebP-Bilder sind erlaubt.'),
    );
    renderPage();

    pickFile(imageFile());
    fireEvent.click(screen.getByRole('button', { name: 'Status teilen' }));

    expect(
      await screen.findByText('Nur JPEG-, PNG- und WebP-Bilder sind erlaubt.'),
    ).toBeInTheDocument();
  });

  it('rejects a file with an unsupported type or more than 5 MB before sending', async () => {
    renderPage();

    pickFile(imageFile('notizen.txt', 'text/plain'));
    expect(
      screen.getByText('Nur JPEG-, PNG- und WebP-Bilder sind erlaubt.'),
    ).toBeInTheDocument();

    const oversized = imageFile('riesig.png', 'image/png');
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 });
    pickFile(oversized);
    expect(
      screen.getByText('Die Datei ist zu groß. Maximal 5 MB sind erlaubt.'),
    ).toBeInTheDocument();

    expect(apiMock.upload).not.toHaveBeenCalled();
  });
});
