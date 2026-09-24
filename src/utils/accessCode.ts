// Access-code helpers: SHA-256(salt + '::' + code), salt generation.
import { sha256HexStr } from './docSeal';

export async function sha256Hex(s: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through to sync implementation */ }
  return sha256HexStr(s);
}

export function makeSalt(): string {
  const a = new Uint32Array(4);
  crypto.getRandomValues(a);
  return Array.from(a).map((x) => x.toString(36)).join('') + Date.now().toString(36);
}

export const ACCESS_MAX_ATTEMPTS = 3;
export const ACCESS_LOCK_MINUTES = 5;
export const OWNER_EMAIL = 'mouniranancy@gmail.com';
