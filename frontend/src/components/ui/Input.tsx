import { useId, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function Input({ label, error, hint, id, className = '', ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <div className={`field ${className}`}>
    <label htmlFor={inputId}>{label}</label>
    <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${inputId}-message` : undefined} {...props} />
    {(error || hint) && <small id={`${inputId}-message`} className={error ? 'field-error' : ''}>{error || hint}</small>}
  </div>;
}
