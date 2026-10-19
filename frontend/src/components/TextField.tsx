import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { FormField } from './FormField';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [inputProps['aria-describedby'], hintId, errorId]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField
      label={label}
      htmlFor={fieldId}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      className={containerClassName}
    >
      <input
        {...inputProps}
        id={fieldId}
        className={cn('input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
    </FormField>
  );
}

export type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

export function PasswordField(props: PasswordFieldProps) {
  return <TextField {...props} type="password" />;
}

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export function TextareaField({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  ...textareaProps
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [textareaProps['aria-describedby'], hintId, errorId]
    .filter(Boolean)
    .join(' ');

  return (
    <FormField
      label={label}
      htmlFor={fieldId}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      className={containerClassName}
    >
      <textarea
        {...textareaProps}
        id={fieldId}
        className={cn('textarea', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
    </FormField>
  );
}

export const TextInput = TextField;
export const Textarea = TextareaField;
