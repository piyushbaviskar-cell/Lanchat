export function safeGetStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[SafeStorage] Malformed JSON for "${key}", reverting to fallback:`, err);
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[SafeStorage] Quota exceeded or storage failure for "${key}":`, err);
  }
}

export async function generateSafeFingerprint(): Promise<string> {
  // If browser context disabled subtle crypto, fallback to pseudo-random hash
  if (!window.crypto || !window.crypto.subtle) {
    console.warn('[Crypto] Insecure context: SubtleCrypto unavailable. Using fallback entropy.');
    return Math.random().toString(16).substring(2, 6).toUpperCase();
  }

  try {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const rawKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawKey);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 2).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (err) {
    console.error('[Crypto] Error deriving key fingerprint:', err);
    return 'E101';
  }
}
