import path from 'node:path';
import { lstat, mkdir, readFile, readdir, rm, statfs } from 'node:fs/promises';

export const validFlamingoUploadId = (value) =>
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const uploadExpiryMs = 48 * 60 * 60 * 1000;
const allocatedBytes = (details) =>
  Math.min(details.size, details.blocks * 512);
const fileDetails = async (filename) => {
  try {
    return await lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

// Each sparse .part reserves its unwritten bytes. Serializing admission at the
// caller prevents several phones from promising themselves the same disk space.
export function createFlamingoUploadStorage({
  directory,
  reserveBytes = 64 * 1024 ** 2,
  expiryMs = uploadExpiryMs,
  filesystem = statfs,
  now = Date.now,
  isBusy = () => false,
  withLock = (_id, task) => task(),
  isPublished = async () => true
}) {
  const pending = path.join(directory, '.pending');
  const paths = (id) => ({
    meta: path.join(pending, `${id}.json`),
    data: path.join(pending, `${id}.part`)
  });
  async function entries() {
    await mkdir(pending, { recursive: true });
    return readdir(pending);
  }
  async function manifest(id) {
    const locations = paths(id);
    const details = await fileDetails(locations.meta);
    if (!details?.isFile()) return null;
    try {
      const metadata = JSON.parse(await readFile(locations.meta, 'utf8'));
      if (
        metadata.id !== id ||
        !Number.isSafeInteger(metadata.size) ||
        metadata.size < 1 ||
        typeof metadata.name !== 'string' ||
        !metadata.name ||
        path.basename(metadata.name) !== metadata.name
      )
        return null;
      return { metadata, details, locations };
    } catch (error) {
      if (error instanceof SyntaxError || error.code === 'ENOENT') return null;
      throw error;
    }
  }
  async function inspect() {
    const names = await entries();
    let reservedBytes = 0;
    for (const name of names) {
      const id = name.slice(0, -5);
      if (!name.endsWith('.json') || !validFlamingoUploadId(id)) continue;
      const record = await manifest(id);
      if (!record || record.metadata.postId) continue;
      const part = await fileDetails(record.locations.data);
      if (part?.isFile())
        reservedBytes += Math.max(
          0,
          record.metadata.size - allocatedBytes(part)
        );
    }
    const space = await filesystem(directory);
    const freeBytes = Number(space.bavail) * Number(space.bsize);
    return {
      capacityBytes: Number(space.blocks) * Number(space.bsize),
      freeBytes,
      reservedBytes,
      reserveBytes,
      availableBytes: Math.max(0, freeBytes - reservedBytes - reserveBytes)
    };
  }
  async function assertCapacity(bytes = 0) {
    const space = await inspect();
    if (
      bytes > space.availableBytes ||
      space.freeBytes < space.reservedBytes + reserveBytes
    ) {
      throw Object.assign(
        new Error(
          'There is not enough media storage for this upload. Your selection is kept; storage needs to be freed before retrying.'
        ),
        {
          status: 507,
          code: 'WALL_DISK_FULL',
          retryable: false
        }
      );
    }
    return space;
  }
  async function sweep() {
    const names = await entries();
    const ids = new Set(
      names
        .filter((name) => /\.(part|json)$/.test(name))
        .map((name) => name.slice(0, -5))
        .filter(validFlamingoUploadId)
    );
    let removed = 0;
    let recoveredBytes = 0;
    for (const id of ids) {
      if (isBusy(id)) continue;
      await withLock(id, async () => {
        const record = await manifest(id);
        const locations = paths(id);
        const part = await fileDetails(locations.data);
        const meta = await fileDetails(locations.meta);
        // Keep malformed manifests for inspection. Never follow links or infer
        // a final filename from unvalidated metadata.
        if (meta && !record) return;
        if (record?.metadata.postId) return;
        const metadata = record?.metadata;
        const lastActivity = Math.max(
          meta?.mtimeMs || 0,
          part?.mtimeMs || 0,
          Number(metadata?.updatedAt || metadata?.createdAt) || 0
        );
        if (lastActivity > now() - expiryMs) return;
        if (part && !part.isFile()) return;
        const finalPath = metadata
          ? path.join(directory, `${id}-${metadata.name}`)
          : null;
        const final = finalPath ? await fileDetails(finalPath) : null;
        if (final && (!final.isFile() || (await isPublished(id, metadata)))) return;
        // A failed database save can leave the completed original beside the
        // manifest. Delete it only after confirming no published post uses it.
        if (final) {
          await rm(finalPath);
          recoveredBytes += allocatedBytes(final);
        }
        if (part) {
          await rm(locations.data);
          recoveredBytes += allocatedBytes(part);
        }
        if (meta) await rm(locations.meta);
        if (part || meta || final) removed += 1;
      });
    }
    return { removed, recoveredBytes };
  }
  return { inspect, assertCapacity, sweep };
}
