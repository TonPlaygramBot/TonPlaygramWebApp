import path from 'path';
import { access, rm } from 'fs/promises';

export const flamingoStorageDirectories = (primaryDirectory, legacyDirectory) => (
  [...new Set([primaryDirectory, ...(Array.isArray(legacyDirectory) ? legacyDirectory : [legacyDirectory])]
    .filter(Boolean).map(directory => path.resolve(directory)))]
);

export const flamingoMediaName = url => {
  try {
    return path.basename(decodeURIComponent(new URL(String(url), 'https://wall.local').pathname));
  } catch {
    return path.basename(String(url || '').split(/[?#]/, 1)[0]);
  }
};

export const findFlamingoMedia = async (name, directories) => {
  const safeName = path.basename(String(name || ''));
  for (const directory of directories) {
    const candidate = path.join(directory, safeName);
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return null;
};

export const removeFlamingoMedia = async (name, directories) => {
  const safeName = path.basename(String(name || ''));
  await Promise.all(directories.map(directory => rm(path.join(directory, safeName), { force: true })));
};
