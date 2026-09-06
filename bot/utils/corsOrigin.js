// Capacitor origins used by the installed web views. CORS is not authentication:
// these origins must still pass the normal account/session/wallet authorization.
export const nativeAppOrigins = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost'
]);

export function isAllowedApiOrigin(origin, allowedOrigins = [], production = false) {
  if (!origin) return true;
  if (nativeAppOrigins.has(origin) || allowedOrigins.includes(origin)) return true;
  if (production) return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
