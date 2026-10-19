import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banner, Button, FormField, buttonClassName } from '../components';
import { AppShell } from '../layout/AppShell';
import { ApiError, api } from '../lib/api';
import type { StatusItemOut } from '../lib/types';
import './StatusCreatePage.css';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MISSING_IMAGE_MESSAGE = 'Bitte wähle zuerst ein Bild für deinen Status.';
const INVALID_IMAGE_MESSAGE = 'Nur JPEG-, PNG- und WebP-Bilder sind erlaubt.';
const TOO_LARGE_MESSAGE = 'Die Datei ist zu groß. Maximal 5 MB sind erlaubt.';

function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return INVALID_IMAGE_MESSAGE;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return TOO_LARGE_MESSAGE;
  }
  return null;
}

function BackIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5 17 4.5-4.5 3.5 3.5 2.5-2.5L19 17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 12 16-7-5 16-3.4-6.6L4 12Z" />
    </svg>
  );
}

export default function StatusCreatePage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSubmitError(null);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageError(null);
      return;
    }

    const validationMessage = validateImage(file);
    if (validationMessage) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageError(validationMessage);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImageError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!selectedFile) {
      setImageError(MISSING_IMAGE_MESSAGE);
      return;
    }

    const validationMessage = validateImage(selectedFile);
    if (validationMessage) {
      setImageError(validationMessage);
      return;
    }

    const trimmedCaption = caption.trim();
    setSubmitting(true);
    try {
      await api.upload<StatusItemOut>(
        '/api/status',
        selectedFile,
        trimmedCaption ? { caption: trimmedCaption } : undefined,
      );
      navigate('/chats');
    } catch (caught: unknown) {
      setSubmitError(
        caught instanceof ApiError ? caught.message : 'Der Status konnte nicht geteilt werden.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const captionLabel: ReactNode = (
    <>
      Bildunterschrift{' '}
      <span className="muted" style={{ fontWeight: 500 }}>
        (optional)
      </span>
    </>
  );

  return (
    <AppShell>
      <header className="page-header" data-od-id="status-create-header">
        <div className="page-header__copy">
          <div className="eyebrow">Status · 24 Stunden</div>
          <h1>Neuer Status</h1>
          <p className="page-subtitle">
            Teile einen Moment mit deinem Team. Dein Status ist für alle Kontakte sichtbar und
            verschwindet nach 24 Stunden.
          </p>
        </div>
        <div className="page-actions">
          <Link className={buttonClassName({ variant: 'outline' })} to="/chats">
            <BackIcon />
            Zurück zu den Chats
          </Link>
        </div>
      </header>

      <div className="status-composer">
        <section
          className="status-preview"
          aria-label="Vorschau deines Status"
          data-od-id="status-create-preview"
        >
          {previewUrl ? <img src={previewUrl} alt="Vorschau des Statusbilds" /> : null}
          <div className="status-preview__scrim" />
          <div className="status-preview__top" aria-hidden="true">
            <div className="status-preview__seg" />
            <div className="status-preview__seg" />
            <div className="status-preview__seg" />
          </div>
          {caption.trim() ? (
            <div className="status-preview__caption">{caption.trim()}</div>
          ) : null}
        </section>

        <form
          className="status-form-card"
          id="status-form"
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          data-od-id="status-create-form"
        >
          <h2>Was ist heute dein Moment?</h2>
          <p className="status-form-card__intro">
            Ein Bild reicht. Eine kurze Zeile macht daraus einen Status.
          </p>

          <div className="form-stack">
            <FormField label="Statusbild" error={imageError}>
              <label className="upload-box" htmlFor="status-image">
                <span className="upload-box__icon">
                  <ImageIcon />
                </span>
                <strong>Bild auswählen</strong>
                <span>JPEG, PNG oder WebP · maximal 5 MB</span>
                <input
                  id="status-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </label>
            </FormField>

            <FormField
              label={captionLabel}
              htmlFor="status-caption"
              hint="Bis zu 90 Zeichen. Die Unterschrift erscheint über dem Bild."
              hintId="status-caption-hint"
            >
              <input
                className="input"
                id="status-caption"
                type="text"
                maxLength={90}
                value={caption}
                autoComplete="off"
                aria-describedby="status-caption-hint"
                onChange={(event) => setCaption(event.target.value)}
              />
            </FormField>

            <div className="status-expiry">
              <ClockIcon />
              <span>Sichtbar für alle Kontakte · verschwindet automatisch nach 24 Stunden.</span>
            </div>

            {submitError ? <Banner variant="error">{submitError}</Banner> : null}

            <div className="form-actions" style={{ justifyContent: 'stretch' }}>
              <Button
                variant="primary"
                size="lg"
                block
                type="submit"
                loading={submitting}
              >
                <SendIcon />
                Status teilen
              </Button>
            </div>
            <Link className={buttonClassName({ variant: 'ghost', block: true })} to="/chats">
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
