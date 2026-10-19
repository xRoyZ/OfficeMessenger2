import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Banner, Button, PasswordField, TextField } from '../components';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { AuthLayout } from '../layout/AuthLayout';

const EMAIL_PLACEHOLDER = 'name@nordlicht.studio';
const LOGIN_ERROR = 'Anmeldung fehlgeschlagen. Bitte prüfe deine Zugangsdaten.';

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Bitte gib deine E-Mail-Adresse ein.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Bitte gib eine gültige E-Mail-Adresse ein.';
  }
  return null;
}

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/chats" replace />;
  }

  const emailError = validateEmail(email);
  const passwordError = password ? null : 'Bitte gib dein Passwort ein.';
  const showEmailError = !formError && (touched.email || submitted) ? emailError : null;
  const showPasswordError = !formError && (touched.password || submitted) ? passwordError : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);

    if (emailError || passwordError) {
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/chats', { replace: true });
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError
          ? LOGIN_ERROR
          : 'Anmeldung fehlgeschlagen. Bitte versuche es später erneut.',
      );
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      brand={{
        eyebrow: 'Dein Team, an einem Ort',
        title: 'Ein ruhiger Ort für die tägliche Zusammenarbeit.',
        text: 'Direkte Gespräche, gemeinsame Gruppen und Momente aus dem Arbeitsalltag — ohne Umwege. Alles bleibt im Team.',
        preview: {
          avatarName: 'Clara',
          name: 'Produkt & Design',
          meta: '5 Mitglieder · jetzt',
          incoming: 'Die neuen Screens liegen im Review. Schaut gern schon rein.',
          outgoing: 'Mache ich. Der Status von heute Morgen ist stark.',
        },
      }}
      panel={{
        eyebrow: 'Willkommen zurück',
        title: 'Schön, dass du da bist.',
        text: 'Melde dich an, um mit deinem Team weiterzuschreiben.',
      }}
      form={
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <TextField
            label="E-Mail-Adresse"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={EMAIL_PLACEHOLDER}
            required
            value={email}
            error={showEmailError ?? undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setFormError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          />

          <PasswordField
            label="Passwort"
            name="password"
            autoComplete="current-password"
            placeholder="Dein Passwort"
            required
            value={password}
            error={showPasswordError ?? undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              setFormError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          />

          {formError ? <Banner variant="error">{formError}</Banner> : null}

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            Anmelden
          </Button>
        </form>
      }
      afterForm={
        <p className="auth-demo">
          <span>Demo-Zugang</span>
          <code>anna@nordlicht.studio</code> · <code>office2</code>
        </p>
      }
      switchPrompt={
        <>
          Noch kein Konto? <Link to="/registrieren">Konto erstellen</Link>
        </>
      }
    />
  );
}
