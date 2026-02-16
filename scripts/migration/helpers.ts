/**
 * Shared helpers for Firestore-to-Neon migration
 */

type FirestoreTimestamp = {toDate: () => Date} | {_seconds: number; _nanoseconds: number};

export function toISOString(value: unknown): string {
  if (!value) return new Date().toISOString();

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as FirestoreTimestamp & {toDate: () => Date}).toDate().toISOString();
  }

  if (value && typeof value === 'object' && '_seconds' in value) {
    return new Date((value as {_seconds: number})._seconds * 1000).toISOString();
  }

  return new Date().toISOString();
}

export function toDate(value: unknown): Date {
  return new Date(toISOString(value));
}

export function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

export function logSuccess(msg: string) {
  console.log(`[migrate] OK  ${msg}`);
}

export function logWarn(msg: string) {
  console.warn(`[migrate] WARN  ${msg}`);
}

export function logError(msg: string) {
  console.error(`[migrate] ERR  ${msg}`);
}
