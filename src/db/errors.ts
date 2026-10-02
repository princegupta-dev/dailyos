import type { ValidationIssue } from '@/lib/validation';

export type AppErrorKind =
  | 'validation'
  | 'not_found'
  | 'invalid_operation'
  | 'conflict'
  | 'quota'
  | 'unavailable'
  | 'version'
  | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly issues: readonly ValidationIssue[];

  constructor(
    kind: AppErrorKind,
    message: string,
    options: { cause?: unknown; issues?: readonly ValidationIssue[] } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.issues = options.issues ?? [];
  }
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { name, inner, failures } = error as {
    name?: unknown;
    inner?: unknown;
    failures?: unknown;
  };
  // Dexie wraps native DOMExceptions; the original is on `inner`.
  if (name === 'QuotaExceededError' || name === 'ConstraintError') return name;
  // Bulk writes report each failed record in `failures`; the first one explains the problem.
  if (name === 'BulkError' && Array.isArray(failures) && failures.length > 0) {
    return errorName((failures as unknown[]).find((f) => f !== undefined)) ?? name;
  }
  if (inner !== undefined) return errorName(inner) ?? (typeof name === 'string' ? name : undefined);
  return typeof name === 'string' ? name : undefined;
}

/** Normalizes anything thrown by IndexedDB/Dexie or our own code into an AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const name = errorName(error);
  const cause = error;
  switch (name) {
    case 'QuotaExceededError':
      return new AppError(
        'quota',
        'This device is out of storage space for DailyOS. Free up space or export a backup.',
        { cause },
      );
    case 'ConstraintError':
      return new AppError('conflict', 'A record with the same key already exists.', { cause });
    case 'VersionError':
      return new AppError(
        'version',
        'Your saved data was created by a newer version of DailyOS. Reload to update the app.',
        { cause },
      );
    case 'MissingAPIError':
    case 'OpenFailedError':
    case 'DatabaseClosedError':
    case 'InvalidStateError':
    case 'UnknownError':
      return new AppError(
        'unavailable',
        'Local storage is unavailable. Private browsing or restricted site data can block it.',
        { cause },
      );
    default:
      return new AppError(
        'unknown',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
        { cause },
      );
  }
}
