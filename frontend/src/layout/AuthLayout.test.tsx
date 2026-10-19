import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthLayout, type AuthBrandContent } from './AuthLayout';

const authStyles = readFileSync(resolve(process.cwd(), 'src/styles/auth.css'), 'utf8');

const LOGIN_BRAND_TITLE = 'Ein ruhiger Ort für die tägliche Zusammenarbeit.';

const loginBrand: AuthBrandContent = {
  eyebrow: 'Dein Team, an einem Ort',
  title: LOGIN_BRAND_TITLE,
  text: 'Direkte Gespräche, gemeinsame Gruppen und Momente aus dem Arbeitsalltag — ohne Umwege. Alles bleibt im Team.',
  preview: {
    avatarName: 'Clara',
    name: 'Produkt & Design',
    meta: '5 Mitglieder · jetzt',
    incoming: 'Die neuen Screens liegen im Review. Schaut gern schon rein.',
    outgoing: 'Mache ich. Der Status von heute Morgen ist stark.',
  },
};

function renderLoginLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout
        brand={loginBrand}
        panel={{
          eyebrow: 'Willkommen zurück',
          title: 'Schön, dass du da bist.',
          text: 'Melde dich an, um mit deinem Team weiterzuschreiben.',
        }}
        form={<form aria-label="Anmeldung" />}
        switchPrompt={<span>Noch kein Konto?</span>}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('AuthLayout brand column', () => {
  it('renders the complete hero headline without truncating it', () => {
    renderLoginLayout();

    const heading = screen.getByRole('heading', { level: 1, name: LOGIN_BRAND_TITLE });

    expect(heading.textContent).toBe(LOGIN_BRAND_TITLE);
    expect(heading).not.toHaveAttribute('style');
    expect(heading.className).not.toMatch(/(truncate|line-clamp|nowrap|ellipsis)/i);
  });

  it('allows the long compound word in the hero headline to wrap instead of overflowing', () => {
    const rule = /\.auth-brand__copy h1\s*\{([^}]*)\}/.exec(authStyles);
    expect(rule).not.toBeNull();

    const declarations = rule?.[1] ?? '';
    expect(declarations).toMatch(/overflow-wrap:\s*break-word/);
    expect(declarations).toMatch(/hyphens:\s*auto/);
  });
});
