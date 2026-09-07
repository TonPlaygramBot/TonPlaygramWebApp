import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import {
  assertFlamingoDurability,
  flamingoLocalDirectory,
  flamingoUploadDirectory,
  inspectFlamingoDurability,
  mountedFlamingoDisk
} from '../bot/utils/flamingoDurability.js';

const root = '1 0 0:1 / / rw - overlay overlay rw\n';
const disk = '2 1 8:32 / /var/data/tonplaygram rw - ext4 /dev/disk rw\n';
const directory = '/var/data/tonplaygram/flamingo-uploads';
const expected = '/var/data/tonplaygram';

test('Render defaults to the mounted media location even without FLAMINGO_UPLOAD_DIR', () => {
  expect(flamingoUploadDirectory({ RENDER: 'true' })).toBe(directory);
  expect(flamingoUploadDirectory({ RENDER_SERVICE_ID: 'service' })).toBe(
    directory
  );
  expect(flamingoUploadDirectory({})).toBe(flamingoLocalDirectory);
  expect(
    flamingoUploadDirectory({
      RENDER: 'true',
      FLAMINGO_UPLOAD_DIR: '/custom/uploads'
    })
  ).toBe('/custom/uploads');
});

test('free space and mkdir on the root filesystem cannot masquerade as a persistent disk', () => {
  expect(mountedFlamingoDisk(root, directory, expected)).toBe(false);
  expect(mountedFlamingoDisk(root + disk, directory, expected)).toBe(true);
  expect(
    mountedFlamingoDisk(
      root + '2 1 8:32 / /var rw - ext4 /dev/disk rw\n',
      directory,
      expected
    )
  ).toBe(false);
  expect(
    mountedFlamingoDisk(
      root + disk,
      '/opt/render/project/src/bot/data/flamingo-uploads',
      expected
    )
  ).toBe(false);
  expect(
    mountedFlamingoDisk(
      root +
        disk +
        '3 2 0:8 / /var/data/tonplaygram/flamingo-uploads rw - tmpfs tmpfs rw\n',
      directory,
      expected
    )
  ).toBe(false);
});

test('mount matching respects path boundaries and escaped Linux mount paths', () => {
  expect(
    mountedFlamingoDisk(
      root + disk,
      '/var/data/tonplaygram-old/files',
      expected
    )
  ).toBe(false);
  expect(
    mountedFlamingoDisk(
      root + '2 1 8:32 / /var/data/media\\040disk rw - ext4 /dev/disk rw\n',
      '/var/data/media disk/uploads',
      '/var/data/media disk'
    )
  ).toBe(true);
});

test('symlinks out of the persistent mount are rejected after canonicalization', async () => {
  const status = await inspectFlamingoDurability(directory, {
    env: { RENDER: 'true' },
    readMounts: async () => root + disk,
    canonicalize: async (value) =>
      value === directory ? '/tmp/uploads' : value
  });
  expect(status).toMatchObject({
    required: true,
    persistent: false,
    disk: 'ephemeral'
  });
});

test('unreadable mount information fails closed while explicit GridFS remains a durable alternative', async () => {
  const local = await mkdtemp(path.join(tmpdir(), 'wall-durability-'));
  const options = {
    env: { RENDER: 'true' },
    canonicalize: async (value) => value,
    readMounts: async () => {
      throw new Error('Unavailable');
    }
  };
  try {
    await expect(
      assertFlamingoDurability(local, options)
    ).rejects.toMatchObject({
      code: 'WALL_STORAGE_NOT_DURABLE',
      status: 503,
      retryable: false
    });
    await expect(
      assertFlamingoDurability(local, {
        ...options,
        env: { ...options.env, FLAMINGO_GRIDFS_BACKUP: 'true' }
      })
    ).resolves.toMatchObject({ persistent: false, required: true });
  } finally {
    await rm(local, { recursive: true, force: true });
  }
});
