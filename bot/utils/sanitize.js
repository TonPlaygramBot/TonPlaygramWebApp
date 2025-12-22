function sanitizeText(value = '') {
  const str = String(value || '');
  return str.replace(/[<>]/g, '').trim();
}

function sanitizeUrl(url = '') {
  const safe = String(url || '').trim();
  if (!safe) return '';
  if (/^https?:\/\//i.test(safe)) return safe;
  return '';
}

export { sanitizeText, sanitizeUrl };
