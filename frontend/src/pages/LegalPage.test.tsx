import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Legal pages', () => {
  it('renders the imprint route for a visitor who is not signed in', () => {
    renderRoute('/impressum');

    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Anbieter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Datenschutz' })).toBeInTheDocument();
    expect(screen.getByText(/Diese Seite ist ohne Anmeldung erreichbar/)).toBeInTheDocument();
  });

  it('renders the privacy route for a visitor who is not signed in', () => {
    renderRoute('/datenschutz');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '1. Verantwortliche Stelle' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Diese Seite ist ohne Anmeldung erreichbar/)).toBeInTheDocument();
  });

  it('documents the 24-hour status lifetime and account deletion', () => {
    renderRoute('/datenschutz');

    expect(screen.getAllByText(/24 Stunden/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Nach einer Kontolöschung/)).toBeInTheDocument();
  });

  it('links both legal pages from the shell footer without a signed-in user', () => {
    renderRoute('/impressum');

    const banner = screen.getByRole('banner', { name: 'App-Navigation' });
    expect(within(banner).getByRole('link', { name: 'Anmelden' })).toHaveAttribute(
      'href',
      '/anmelden',
    );

    const footer = screen.getByText('OfficeMessenger2 · internes Büro').closest('footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      '/impressum',
    );
    expect(
      within(footer as HTMLElement).getByRole('link', { name: 'Datenschutzerklärung' }),
    ).toHaveAttribute('href', '/datenschutz');
  });
});
