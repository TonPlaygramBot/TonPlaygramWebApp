import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, realpath } from 'node:fs/promises';

export const flamingoLocalDirectory = fileURLToPath(
  new URL('../data/flamingo-uploads', import.meta.url)
);
export const flamingoRenderMount = '/var/data/tonplaygram';
export const isRenderEnvironment = (env = process.env) =>
  env.RENDER === 'true' ||
  Boolean(env.RENDER_SERVICE_ID || env.RENDER_EXTERNAL_HOSTNAME);
export const flamingoUploadDirectory = (env = process.env) =>
  path.resolve(
    env.FLAMINGO_UPLOAD_DIR ||
      (isRenderEnvironment(env)
        ? path.join(
            env.FLAMINGO_PERSISTENT_MOUNT_PATH || flamingoRenderMount,
            'flamingo-uploads'
          )
        : flamingoLocalDirectory)
  );

const within = (parent, child) =>
  child === parent || child.startsWith(`${parent === '/' ? '' : parent}/`);
const unescapeMount = (value) =>
  value.replace(/\\(040|011|012|134)/g, (_, octal) =>
    String.fromCharCode(parseInt(octal, 8))
  );
export function mountedFlamingoDisk(mountInfo, directory, expectedMount) {
  if (!within(expectedMount, directory)) return false;
  const mounts = String(mountInfo)
    .split('\n')
    .flatMap((line) => {
      const [fields, filesystem] = line.split(' - ');
      const mountPoint = fields?.split(' ')[4];
      return mountPoint && filesystem
        ? [{ path: unescapeMount(mountPoint), type: filesystem.split(' ')[0] }]
        : [];
    });
  const mount = mounts
    .filter((item) => within(item.path, directory))
    .sort((a, b) => b.path.length - a.path.length)[0];
  // A directory's existence/free space does not establish durability. Require
  // the configured non-root mount backed by a disk filesystem, and reject
  // unrelated parent mounts or volatile nested mounts that shadow it.
  return Boolean(
    mount &&
    mount.path !== '/' &&
    mount.path === expectedMount &&
    ['ext4', 'xfs', 'btrfs'].includes(mount.type)
  );
}

export async function inspectFlamingoDurability(
  directory = flamingoUploadDirectory(),
  {
    env = process.env,
    canonicalize = realpath,
    readMounts = () => readFile('/proc/self/mountinfo', 'utf8')
  } = {}
) {
  if (!isRenderEnvironment(env))
    return { disk: 'local', persistent: false, required: false };
  try {
    const expected = path.resolve(
      env.FLAMINGO_PERSISTENT_MOUNT_PATH || flamingoRenderMount
    );
    const [resolved, resolvedMount, mounts] = await Promise.all([
      canonicalize(directory),
      canonicalize(expected),
      readMounts()
    ]);
    const persistent = mountedFlamingoDisk(mounts, resolved, resolvedMount);
    return {
      disk: persistent ? 'persistent' : 'ephemeral',
      persistent,
      required: true
    };
  } catch {
    return { disk: 'unverified', persistent: false, required: true };
  }
}

export async function assertFlamingoDurability(
  directory = flamingoUploadDirectory(),
  options = {}
) {
  await mkdir(directory, { recursive: true });
  const durability = await inspectFlamingoDurability(directory, options);
  const env = options.env || process.env;
  const backup = /^(1|true|yes|on)$/i.test(
    String(env.FLAMINGO_GRIDFS_BACKUP || '').trim()
  );
  if (durability.required && !durability.persistent && !backup) {
    throw Object.assign(
      new Error(
        'Media uploads are temporarily unavailable while permanent storage is restored. Keep your file and try again later.'
      ),
      {
        status: 503,
        code: 'WALL_STORAGE_NOT_DURABLE',
        retryable: false
      }
    );
  }
  return durability;
}
