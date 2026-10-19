import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Banner, Button, PasswordField, TextField } from '../components';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { AuthLayout } from '../layout/AuthLayout';

const EMAIL_PLACEHOLDER = 'name@nordlicht.studio';
const EMAIL_TAKEN_ERROR = 'Diese E-Mail-Adresse ist bereits vergeben.';
const REGISTER_ERROR = 'Die Registrierung ist fehlgeschlagen. Bitte versuche es später erneut.';
const PASSWORD_HINT = 'Mindestens 8 Zeichen. Verwende möglichst eine eigene Passphrase.';

function validateDisplayName(value: string): string | null {
  return value.trim() ? null : 'Bitte gib deinen Anzeigenamen ein.';
}

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

function validatePassword(value: string): string | null {
  if (!value) {
    return 'Bitte gib ein Passwort ein.';
  }
  if (value.length < 8) {
    return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
  }
  return null;
}

export default function RegisterPage() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ displayName: false, email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/chats" replace />;
  }

  const displayNameError = validateDisplayName(displayName);
  const emailValidationError = validateEmail(email);
  const passwordError = validatePassword(password);
  const showDisplayNameError = touched.displayName || submitted ? displayNameError : null;
  const showEmailError = touched.email || submitted ? emailValidationError : null;
  const showPasswordError = touched.password || submitted ? passwordError : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    setEmailError(null);

    if (displayNameError || emailValidationError || passwordError) {
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), displayName.trim(), password);
      navigate('/chats', { replace: true });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'email_taken') {
        setEmailError(EMAIL_TAKEN_ERROR);
      } else {
        setFormError(REGISTER_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      brand={{
        eyebrow: 'Ein Konto. Das ganze Team.',
        title: 'Ankommen, kurz vorstellen, mitreden.',
        text: 'Erstelle dein Konto mit E-Mail, Anzeigename und Passwort. Danach findest du alle Kolleg:innen im Verzeichnis und kannst direkt ins Gespräch starten.',
        preview: {
          avatarName: 'Greta',
          name: 'Greta Sommer',
          meta: 'People & Culture',
          incoming: 'Willkommen im Team, Jonas! Wenn du Fragen hast, schreib einfach.',
          outgoing: 'Danke! Ich schaue mich erst einmal in den Gruppen um.',
        },
      }}
      panel={{
        eyebrow: 'Neu im Team',
        title: 'Konto erstellen',
        text: 'Drei Angaben, dann bist du dabei. Deine E-Mail-Adresse siehst nur du in deinem Profil.',
      }}
      form={
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <TextField
            label="Anzeigename"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Vor- und Nachname"
            required
            value={displayName}
            error={showDisplayNameError ?? undefined}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFormError(null);
            }}
            onBlur={() => setTouched((current) => ({ ...current, displayName: true }))}
          />

          <div>
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
                setEmailError(null);
              }}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            />
            {emailError ? <Banner variant="error">{emailError}</Banner> : null}
          </div>

          <PasswordField
            label="Passwort"
            name="password"
            autoComplete="new-password"
            placeholder="Mindestens 8 Zeichen"
            hint={PASSWORD_HINT}
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
            Konto erstellen und anmelden
          </Button>
        </form>
      }
      switchPrompt={
        <>
          Du hast schon ein Konto? <Link to="/anmelden">Anmelden</Link>
        </>
      }
    />
  );
}
