import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './layout/AppShell';

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function TestNavigation() {
  return (
    <nav aria-label="Testnavigation">
      <Link to="/impressum">Impressum öffnen</Link>
      <Link to="/datenschutz">Datenschutz öffnen</Link>
    </nav>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <TestNavigation />
        <LocationDisplay />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('App shell', () => {
  it('renders the header slot, the main slot and the legal footer', () => {
    render(
      <MemoryRouter>
        <AppShell header={<span>Navigation</span>}>
          <p>Inhalt der Seite</p>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner', { name: 'App-Navigation' })).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Inhalt der Seite')).toBeInTheDocument();
    expect(screen.getByText('OfficeMessenger2 · internes Büro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
  });
});

describe('App routing', () => {
  it('switches between two registered routes without a page reload', () => {
    const { container } = renderAt('/impressum');
    const documentElement = document.documentElement;

    fireEvent.click(screen.getByRole('link', { name: 'Datenschutz öffnen' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/datenschutz');
    expect(screen.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeInTheDocument();
    expect(container.querySelector('main')).not.toBeNull();
    expect(document.documentElement).toBe(documentElement);
  });

  it('redirects anonymous visitors from a protected route to the sign-in route', () => {
    renderAt('/chats');

    expect(screen.getByTestId('location')).toHaveTextContent('/anmelden');
  });
});
