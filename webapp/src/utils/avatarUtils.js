export function emojiToDataUrl(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><text y='96' font-size='96'>${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAvatarUrl(src) {
  if (!src) return '';
  if (src.startsWith('/') || src.startsWith('http')) return src;
  return emojiToDataUrl(src);
}

export function saveAvatar(src) {
  if (typeof window !== 'undefined' && src) {
    try {
      localStorage.setItem('profilePhoto', src);
    } catch {}
  }
}

export function loadAvatar() {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('profilePhoto') || '';
    } catch {
      return '';
    }
  }
  return '';
}

export function avatarToName(src) {
  if (!src) return '';
  if (!src.startsWith('/') && !src.startsWith('http')) {
    // Flag emojis consist of two regional indicator symbols
    const chars = Array.from(src);
    if (chars.length === 2 && chars.every(c => c.codePointAt(0) >= 0x1f1e6 && c.codePointAt(0) <= 0x1f1ff)) {
      const code = chars
        .map(c => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 65))
        .join('');
      try {
        const names = new Intl.DisplayNames(['en'], { type: 'region' });
        return names.of(code) || code;
      } catch {
        return code;
      }
    }
    const names = {
      '🐵': 'Monkei',
      '🐒': 'Monkei',
      '🐶': 'Doggo',
      '🐱': 'Catto',
    };
    if (names[src]) return names[src];
    return src;
  }
  const parts = src.split('/');
  return parts[parts.length - 1].split('.')[0];
}
