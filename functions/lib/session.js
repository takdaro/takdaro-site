const SESSION_COOKIE = 'td_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getCookieHeader(request) {
  return request?.headers?.get('cookie') || '';
}

export function parseCookies(request) {
  const cookieHeader = getCookieHeader(request);
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function getSessionTokenFromRequest(request) {
  return parseCookies(request)[SESSION_COOKIE] || null;
}

export function generateSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export async function hashSessionToken(token) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

export function createSessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS };

