import os from 'os';
import path from 'path';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { findFlamingoMedia, flamingoStorageDirectories, removeFlamingoMedia } from '../bot/utils/flamingoStorage.js';

describe('Protesta Shqiptare media storage migration', () => {
  let root;
  let persistentDirectory;
  let legacyDirectory;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'flamingo-storage-'));
    persistentDirectory = path.join(root, 'persistent');
    legacyDirectory = path.join(root, 'legacy');
    await Promise.all([mkdir(persistentDirectory), mkdir(legacyDirectory)]);
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  test('finds videos uploaded before the persistent disk was configured', async () => {
    const legacyVideo = path.join(legacyDirectory, 'morning-protest.mp4');
    await writeFile(legacyVideo, 'video');

    const directories = flamingoStorageDirectories(persistentDirectory, legacyDirectory);
    await expect(findFlamingoMedia('morning-protest.mp4', directories)).resolves.toBe(legacyVideo);
  });

  test('prefers the persistent copy and removes all copies safely', async () => {
    const persistentVideo = path.join(persistentDirectory, 'protest.mp4');
    const legacyVideo = path.join(legacyDirectory, 'protest.mp4');
    await Promise.all([writeFile(persistentVideo, 'new'), writeFile(legacyVideo, 'old')]);
    const directories = flamingoStorageDirectories(persistentDirectory, legacyDirectory);

    await expect(findFlamingoMedia('../protest.mp4', directories)).resolves.toBe(persistentVideo);
    await removeFlamingoMedia('../protest.mp4', directories);
    await expect(findFlamingoMedia('protest.mp4', directories)).resolves.toBeNull();
  });
});
