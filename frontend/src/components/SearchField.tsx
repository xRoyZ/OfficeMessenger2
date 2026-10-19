import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  containerClassName?: string;
}

function SearchIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

export function SearchField({
  label,
  containerClassName,
  className,
  id,
  ...inputProps
}: SearchFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `search-${generatedId}`;

  return (
    <div className={cn('search', containerClassName)}>
      <SearchIcon />
      <label className="sr-only" htmlFor={fieldId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={fieldId}
        type="search"
        className={cn('input', className)}
      />
    </div>
  );
}
