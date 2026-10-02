import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      {children({ inputId, describedBy })}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function TextField({ label, error, hint, className, ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          className={`input${className ? ` ${className}` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function TextAreaField({ label, error, hint, rows = 3, ...textarea }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <textarea
          id={inputId}
          className="input input--textarea"
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...textarea}
        />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  options: readonly { value: string; label: string }[];
};

export function SelectField({ label, error, hint, options, ...select }: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <select
          id={inputId}
          className="input input--select"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...select}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
