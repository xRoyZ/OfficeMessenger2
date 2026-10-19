import type { ReactNode } from 'react';
import { cn } from './cn';

export interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
  className?: string;
  children: ReactNode;
}

function ErrorIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </svg>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  className,
  children,
}: FormFieldProps) {
  const hasError = error !== null && error !== undefined && error !== '';

  return (
    <div className={cn('field', hasError && 'has-error', className)}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? (
        <div className="field__hint" id={hintId}>
          {hint}
        </div>
      ) : null}
      {hasError ? (
        <div className="field__error" id={errorId} role="alert">
          <ErrorIcon />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
