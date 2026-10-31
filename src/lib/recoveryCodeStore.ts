// ── Recovery Code Store ────────────────────────────────────────────────────────
// Generates and manages one-time recovery codes per user.
// Codes are stored in localStorage and consumed (marked used) on login.

const RECOVERY_CODES_KEY = 'nido_recovery_codes';

export interface RecoveryCode {
  code: string;    // e.g. "ABCDE-12345-FGHIJ"
  used: boolean;
  usedAt?: string; // ISO timestamp when consumed
}

export interface UserRecoveryCodes {
  userId: string;
  email: string;
  codes: RecoveryCode[];
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (ambiguous)

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function generateCode(): string {
  const seg = () => Array.from({ length: 5 }, randomChar).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

// ── Storage ────────────────────────────────────────────────────────────────────

function loadAll(): UserRecoveryCodes[] {
  try {
    const raw = localStorage.getItem(RECOVERY_CODES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(data: UserRecoveryCodes[]): void {
  localStorage.setItem(RECOVERY_CODES_KEY, JSON.stringify(data));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Return the recovery code record for a user, or null if none exist. */
export function getRecoveryCodes(userId: string): UserRecoveryCodes | null {
  return loadAll().find(r => r.userId === userId) ?? null;
}

/**
 * Generate 8 fresh recovery codes for a user.
 * Replaces any existing codes (call only when user explicitly regenerates).
 */
export function generateRecoveryCodes(userId: string, email: string): RecoveryCode[] {
  const all = loadAll().filter(r => r.userId !== userId);
  const codes: RecoveryCode[] = Array.from({ length: 8 }, () => ({
    code: generateCode(),
    used: false,
  }));
  all.push({ userId, email, codes, generatedAt: new Date().toISOString() });
  saveAll(all);
  return codes;
}

/**
 * Ensure a user has recovery codes. Generates them if none exist yet.
 * Safe to call on every profile page load.
 */
export function ensureRecoveryCodes(userId: string, email: string): RecoveryCode[] {
  const existing = getRecoveryCodes(userId);
  if (existing) return existing.codes;
  return generateRecoveryCodes(userId, email);
}

/**
 * Attempt to authenticate using a recovery code.
 * Returns the userId on success (caller fetches the full user), or null on failure.
 * Marks the code as used if valid.
 */
export function consumeRecoveryCode(
  email: string,
  rawCode: string
): string | null {
  const normalised = rawCode.trim().toUpperCase();
  const all = loadAll();
  const record = all.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (!record) return null;

  const codeIdx = record.codes.findIndex(c => !c.used && c.code === normalised);
  if (codeIdx === -1) return null;

  // Mark consumed
  record.codes[codeIdx].used = true;
  record.codes[codeIdx].usedAt = new Date().toISOString();
  saveAll(all);

  return record.userId;
}

/** Count of remaining (unused) codes for a user. */
export function remainingCodeCount(userId: string): number {
  return getRecoveryCodes(userId)?.codes.filter(c => !c.used).length ?? 0;
}
