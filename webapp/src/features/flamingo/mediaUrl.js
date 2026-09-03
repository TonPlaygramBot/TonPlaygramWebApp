// Older wall records can contain the absolute hostname that served the upload
// at the time it was published. Always route our own media paths through the
// current API host; concatenating an absolute legacy URL produces an invalid
// URL and following the legacy host can fail after a deployment migration.
export function resolveWallMediaUrl(apiBaseUrl, storedUrl, revision = '') {
  const value = String(storedUrl || '').trim();
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return value;

  try {
    const parsed = new URL(value, 'https://wall.local');
    if (parsed.pathname.startsWith('/api/flamingo-wall/')) {
      // A failed response from an earlier deployment may still be held by a
      // phone browser. The attachment size is a stable revision which bypasses
      // that stale 404 without disabling caching for healthy media.
      if (revision !== '' && revision != null) parsed.searchParams.set('v', String(revision));
      return `${String(apiBaseUrl || '').replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
    }
    if (/^https?:$/i.test(parsed.protocol) && parsed.origin !== 'https://wall.local') return parsed.href;
  } catch {
    // Preserve unusual browser-supported sources rather than making them
    // unplayable while normal API paths continue through the branch below.
  }

  return `${String(apiBaseUrl || '').replace(/\/$/, '')}/${value.replace(/^\/+/, '')}`;
}

// A video element does not retry a failed metadata request after the API's
// database connection returns. Give each retry a fresh URL so a phone browser
// cannot reuse the failed response it received during the interruption.
export function retryWallMediaUrl(url, attempt) {
  const value = String(url || '');
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return value;
  try {
    const parsed = new URL(value, 'https://wall.local');
    parsed.searchParams.set('retry', String(Math.max(1, Number(attempt) || 1)));
    return parsed.origin === 'https://wall.local'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.href;
  } catch {
    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}retry=${Math.max(1, Number(attempt) || 1)}`;
  }
}
