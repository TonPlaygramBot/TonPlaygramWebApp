import path from 'path';

export const mediaType = (type, name = '') => {
  const supplied = String(type || '').toLowerCase();
  if (supplied && supplied !== 'application/octet-stream' && supplied !== 'video/*' && supplied !== 'image/*') return supplied;
  const extension = path.extname(String(name || '')).toLowerCase();
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.m4v' || extension === '.mp4') return 'video/mp4';
  if (extension === '.webm') return 'video/webm';
  if (['.avif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp'].includes(extension)) return `image/${extension === '.jpg' ? 'jpeg' : extension.slice(1)}`;
  return supplied || 'application/octet-stream';
};
