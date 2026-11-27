/**
 * Parental lock and setup codes for the pupils profile.
 *
 * - The parent PIN (4–8 digits) is never stored or transmitted in plain text:
 *   only a PBKDF2-SHA-256 hash. The salt is fixed on purpose, so the same PIN
 *   always gives the same hash – this lets a pupil's app accept new setup codes
 *   from the same parent without asking for the PIN.
 *   (A 4-digit PIN cannot be made brute-force proof on-device anyway; the lock
 *   is a household hurdle, not a security boundary. Attempts are rate-limited.)
 * - A setup code transports profile settings from the parent's app to the
 *   pupil's app (e.g. via WhatsApp): "PET1-" + base64url(JSON).
 */
import type { KidGrade } from './grades';

export const PIN_RE = /^\d{4,8}$/;
const SALT = 'personal-english-trainer/parent-pin/v1';
const ITERATIONS = 120_000;

export interface ParentLock {
  v: 1;
  hash: string;
}

export interface SetupConfig {
  v: 1;
  profile: 'kid';
  grade: KidGrade;
  words: number;
  minutesPerWord: number;
  lock: ParentLock;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export async function hashPin(pin: string): Promise<string> {
  if (!PIN_RE.test(pin)) throw new Error('invalid-pin');
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ITERATIONS }, key, 256);
  return b64url(new Uint8Array(bits));
}

export async function makeLock(pin: string): Promise<ParentLock> {
  return { v: 1, hash: await hashPin(pin) };
}

export async function verifyPin(pin: string, lock: ParentLock | undefined): Promise<boolean> {
  if (!lock || !PIN_RE.test(pin)) return false;
  return (await hashPin(pin)) === lock.hash;
}

/* -------------------------------------------------------- setup codes */

const GRADES: KidGrade[] = ['5-6', '7-8', '9-10'];
export const CODE_PREFIX = 'PET1-';

export function encodeSetup(cfg: SetupConfig): string {
  return CODE_PREFIX + b64url(enc.encode(JSON.stringify(cfg)));
}

/** Find and validate a setup code in any text (the whole WhatsApp message, a link or the bare code). */
export function decodeSetup(text: string): SetupConfig | null {
  const m = text.match(/PET1-([A-Za-z0-9_-]{20,2000})/) ?? text.match(/[?&]c=(?:PET1-)?([A-Za-z0-9_-]{20,2000})/);
  if (!m) return null;
  let o: unknown;
  try {
    o = JSON.parse(new TextDecoder().decode(fromB64url(m[1])));
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const c = o as Record<string, unknown>;
  const lock = c.lock as Record<string, unknown> | undefined;
  const words = Number(c.words);
  const mpw = Number(c.minutesPerWord);
  if (c.v !== 1 || c.profile !== 'kid' || !GRADES.includes(c.grade as KidGrade)) return null;
  if (!Number.isInteger(words) || words < 5 || words > 50) return null;
  if (!(mpw > 0 && mpw <= 10)) return null;
  if (!lock || lock.v !== 1 || typeof lock.hash !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(lock.hash)) return null;
  return { v: 1, profile: 'kid', grade: c.grade as KidGrade, words, minutesPerWord: mpw, lock: { v: 1, hash: lock.hash } };
}

export function setupMessage(cfg: SetupConfig, appUrl: string): string {
  const code = encodeSetup(cfg);
  return [
    '🤖 Einrichtung für den English Trainer',
    '',
    `1. App öffnen: ${appUrl}`,
    '2. Diese ganze Nachricht kopieren.',
    '3. In der App auf „Einrichtungscode einfügen“ tippen (beim ersten Start oder unter Einstellungen).',
    '',
    code,
  ].join('\n');
}

/* ------------------------------------------------------- rate limiting */

export const MAX_FAILS = 5;
export const WAIT_MS = 60_000;

/** After MAX_FAILS wrong PINs the next try is blocked for WAIT_MS. */
export function pinWaitMs(fails: number, lastFailAt: number, now: number): number {
  if (fails < MAX_FAILS) return 0;
  return Math.max(0, lastFailAt + WAIT_MS - now);
}
