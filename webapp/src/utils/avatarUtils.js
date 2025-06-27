export function emojiToDataUrl(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><text y='96' font-size='96'>${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAvatarUrl(src) {
  if (!src) return '';
  if (src.startsWith('/') || src.startsWith('http')) return src;
  return emojiToDataUrl(src);
}
