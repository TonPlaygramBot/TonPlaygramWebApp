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

import { emoji } from 'emoji-name-map';
import countryNames from './countryNames.json';

const emojiToNameMap = Object.fromEntries(
  Object.entries(emoji).map(([name, char]) => [char, name])
);
const regionNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function avatarToName(src) {
  if (!src) return '';
  if (!src.startsWith('/') && !src.startsWith('http')) {
    const key = emojiToNameMap[src];
    if (key) {
      const flagMatch = key.match(/flag[-_]?([a-z]{2})/i);
      if (flagMatch) {
        const code = flagMatch[1].toUpperCase();
        try {
          const name = regionNames?.of(code) || countryNames[code];
          if (name) return name;
        } catch {}
        return countryNames[code] || code;
      }
      if (/^[a-z]{2}$/i.test(key)) {
        const code = key.toUpperCase();
        try {
          const name = regionNames?.of(code) || countryNames[code];
          if (name) return name;
        } catch {}
        return countryNames[code] || code;
      }
      return key
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bflag\b/gi, '')
        .replace(/\bof\b/gi, '')
        .replace(/\b(?:Face|Man|Woman|Male|Female|Person)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return '';
  }
  const match = src.match(/avatar(\d+)\.svg$/);
  if (match) return `Avatar ${match[1]}`;
  const file = src.split('/').pop().split('.')[0];
  return file
    .replace(/[_-]/g, ' ')
    .replace(/\bLeader\b/gi, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
