import { useContext, useState, type SyntheticEvent } from 'react';
import { ToastContext } from '@/components/toast-context';
import { AppError, toAppError } from '@/db/errors';
import { parseRupees } from '@/lib/money';
import { issuesByField } from '@/lib/validation';

/**
 * Submits a dialog form: field-level validation messages go beside their fields, any other
 * failure becomes an error toast, and success shows a confirmation and calls `onDone`.
 */
export function useFormSubmit(onDone: () => void) {
  const notify = useContext(ToastContext);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const submit = async (
    event: SyntheticEvent | undefined,
    operation: () => Promise<unknown>,
    successMessage: string,
  ) => {
    event?.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    try {
      await operation();
      notify({ kind: 'success', message: successMessage });
      onDone();
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation' && appError.issues.length > 0) {
        setErrors(issuesByField(appError.issues));
      } else {
        notify({ kind: 'error', message: appError.message });
      }
    } finally {
      setPending(false);
    }
  };

  return { errors, setErrors, pending, submit };
}

const AMOUNT_HINT = 'Enter an amount like 1500 or 1,500.50';

/**
 * Parses a required rupee amount field into paise. Throws a validation error for the field
 * otherwise, so `submit` shows it inline like any other validation message.
 */
export function readAmount(text: string, field: string): number {
  const paise = parseRupees(text);
  if (paise === undefined || paise === 0) {
    throw new AppError('validation', 'Some fields need attention.', {
      issues: [{ path: field, message: AMOUNT_HINT }],
    });
  }
  return paise;
}

/** Like `readAmount`, but an empty field means "not given". */
export function readOptionalAmount(text: string, field: string): number | undefined {
  if (text.trim() === '') return undefined;
  const paise = parseRupees(text);
  if (paise === undefined) {
    throw new AppError('validation', 'Some fields need attention.', {
      issues: [{ path: field, message: AMOUNT_HINT }],
    });
  }
  return paise;
}

/** A balance field: like `readAmount`, but zero is fine and, when allowed, "-" marks an overdraft. */
export function readBalance(text: string, field: string, allowNegative: boolean): number {
  const trimmed = text.trim();
  const negative = allowNegative && /^[-−]/.test(trimmed);
  const paise = trimmed === '' ? 0 : parseRupees(negative ? trimmed.slice(1) : trimmed);
  if (paise === undefined) {
    throw new AppError('validation', 'Some fields need attention.', {
      issues: [
        {
          path: field,
          message: allowNegative
            ? 'Enter an amount like 15000, or -500 if overdrawn'
            : 'Enter an amount like 1500 or 1,500.50',
        },
      ],
    });
  }
  return negative ? -paise : paise;
}
