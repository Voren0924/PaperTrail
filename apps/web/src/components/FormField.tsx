import type { InputHTMLAttributes, ReactNode } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: ReactNode;
};

export function FormField({ label, error, hint, id, ...inputProps }: FormFieldProps) {
  const fieldId = id ?? inputProps.name ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="form-field" htmlFor={fieldId}>
      <span>{label}</span>
      <input id={fieldId} className="input" aria-invalid={Boolean(error)} {...inputProps} />
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
