const PBKDF2_ITERATIONS = 120000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const DIGEST = 'SHA-256';

function encoder() {
  return new TextEncoder();
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function deriveBits(password, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: DIGEST,
      salt,
      iterations,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return ['pbkdf2', DIGEST.toLowerCase(), PBKDF2_ITERATIONS, toBase64(salt), toBase64(hash)].join('$');
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const [algorithm, digest, iterations, saltB64, hashB64] = String(storedHash).split('$');
  if (algorithm !== 'pbkdf2' || digest !== DIGEST.toLowerCase()) return false;

  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);
  const actualHash = new Uint8Array(await deriveBits(password, salt, Number(iterations)));

  return timingSafeEqual(actualHash, expectedHash);
}
