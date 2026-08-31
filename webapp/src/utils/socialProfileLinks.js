const PROFILE_RULES = {
  tiktok: { host: 'www.tiktok.com', path: (id) => `/@${id}` },
  instagram: { host: 'www.instagram.com', path: (id) => `/${id}/` },
  facebook: { host: 'www.facebook.com', path: (id) => `/${id}` },
  youtube: { host: 'www.youtube.com', path: (id) => `/@${id}` },
  x: { host: 'x.com', path: (id) => `/${id}` },
  telegram: { host: 't.me', path: (id) => `/${id}` },
  discord: { host: 'discord.com', path: (id) => `/users/${id}`, numeric: true }
};

const HOST_ALIASES = { 'tiktok.com': 'www.tiktok.com', 'instagram.com': 'www.instagram.com', 'facebook.com': 'www.facebook.com', 'm.facebook.com': 'www.facebook.com', 'youtube.com': 'www.youtube.com', 'twitter.com': 'x.com', 'www.twitter.com': 'x.com', 'www.x.com': 'x.com', 'telegram.me': 't.me', 'www.telegram.me': 't.me', 'www.t.me': 't.me', 'www.discord.com': 'discord.com' };

function identifierFromUrl(platform, raw, rule) {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(candidate); } catch { return ''; }
  const host = HOST_ALIASES[url.hostname.toLowerCase()] || url.hostname.toLowerCase();
  if (host !== rule.host) return '';
  const parts = url.pathname.split('/').filter(Boolean);
  if (platform === 'discord' && parts[0] === 'users') return parts[1] || '';
  if (platform === 'youtube' && parts[0]?.startsWith('@')) return parts[0].slice(1);
  return String(parts[0] || '').replace(/^@/, '');
}

export function normalizeSocialProfile(platform, input) {
  const rule = PROFILE_RULES[platform];
  if (!rule) return { error: 'Unsupported social app.' };
  const raw = String(input || '').trim();
  if (!raw) return { error: `Enter your ${platform === 'x' ? 'X' : platform} username or profile link.` };
  const looksLikeUrl = raw.includes('.') || raw.includes('/') || /^https?:/i.test(raw);
  const identifier = (looksLikeUrl ? identifierFromUrl(platform, raw, rule) : raw.replace(/^@/, '')).trim();
  if (!identifier || !/^[\w.-]+$/.test(identifier)) return { error: 'Use a valid username or official profile link.' };
  if (rule.numeric && !/^\d{5,30}$/.test(identifier)) return { error: 'Discord needs the numeric User ID from Copy User ID.' };
  const cleanIdentifier = identifier.replace(/[.]+$/, '');
  return { accountName: platform === 'discord' ? cleanIdentifier : `@${cleanIdentifier}`, profileUrl: `https://${rule.host}${rule.path(cleanIdentifier)}` };
}

export function loadLinkedProfiles(storage) {
  try {
    const profiles = JSON.parse(storage?.getItem('tonplaygram-social-profiles') || '{}');
    return profiles && typeof profiles === 'object' ? profiles : {};
  } catch { return {}; }
}

export function saveLinkedProfiles(storage, profiles) {
  storage?.setItem('tonplaygram-social-profiles', JSON.stringify(profiles));
}
