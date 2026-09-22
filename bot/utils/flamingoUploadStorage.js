import path from 'node:path';
import { lstat, mkdir, readFile, readdir, rm, statfs } from 'node:fs/promises';

export const validFlamingoUploadId = (value) =>
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const uploadExpiryMs = 48 * 60 * 60 * 1000;
// Keep resumable bytes for 48 hours, but do not let a closed phone reserve
// gigabytes of unwritten space for that entire period. Resumes re-admit below.
export const uploadReservationMs = 5 * 60 * 1000;
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
  reservationMs = uploadReservationMs,
  filesystem = statfs,
  now = Date.now,
  isBusy = () => false,
  withLock = (_id, task) => task(),
  isPublished = async () => true
}) {
  const pending = path.join(directory, '.pending');
  const paths = (id) => ({
    meta: path.join(pending, `${id}.json`),
    native: path.join(pending, `${id}.native`),
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
  async function inspect({ includeUploadId } = {}) {
    const names = await entries();
    let reservedBytes = 0;
    let idleReservedBytes = 0;
    let requestedReservationBytes = 0;
    for (const name of names) {
      const id = name.slice(0, -5);
      if (!name.endsWith('.json') || !validFlamingoUploadId(id)) continue;
      const record = await manifest(id);
      if (!record || record.metadata.postId) continue;
      const part = await fileDetails(record.locations.data);
      let remaining = 0;
      if (part?.isFile())
        remaining += Math.max(0, record.metadata.size - allocatedBytes(part));
      const native = await fileDetails(record.locations.native);
      if (record.metadata.nativeUploadSize === record.metadata.size) {
        remaining += Math.max(
          0,
          record.metadata.size - (native?.isFile() ? allocatedBytes(native) : 0)
        );
      }
      const lastActivity = Math.max(
        record.details.mtimeMs,
        part?.mtimeMs || 0,
        native?.mtimeMs || 0,
        Number(record.metadata.updatedAt || record.metadata.createdAt) || 0
      );
      if (id === includeUploadId) requestedReservationBytes = remaining;
      if (
        id === includeUploadId ||
        isBusy(id) ||
        lastActivity > now() - reservationMs
      )
        reservedBytes += remaining;
      else idleReservedBytes += remaining;
    }
    const space = await filesystem(directory);
    const freeBytes = Number(space.bavail) * Number(space.bsize);
    return {
      capacityBytes: Number(space.blocks) * Number(space.bsize),
      freeBytes,
      reservedBytes,
      idleReservedBytes,
      ...(includeUploadId ? { requestedReservationBytes } : {}),
      reserveBytes,
      availableBytes: Math.max(0, freeBytes - reservedBytes - reserveBytes)
    };
  }
  async function assertCapacity(bytes = 0, options) {
    const space = await inspect(options);
    if (
      bytes > space.availableBytes ||
      space.freeBytes < space.reservedBytes + reserveBytes
    ) {
      const ownReservation = space.requestedReservationBytes || 0;
      const busy =
        space.reservedBytes > ownReservation &&
        bytes + ownReservation + reserveBytes <= space.freeBytes;
      throw Object.assign(
        new Error(
          busy
            ? 'Other uploads have reserved the available server space. Your video is saved and will retry automatically.'
            : 'The server media storage is full. Your video is kept; server storage must be freed or expanded before retrying.'
        ),
        {
          status: busy ? 503 : 507,
          code: busy ? 'WALL_STORAGE_BUSY' : 'WALL_DISK_FULL',
          retryable: busy
        }
      );
    }
    return space;
  }
  async function sweep() {
    const names = await entries();
    const ids = new Set(
      names
        .filter((name) => /\.(part|json|native)$/.test(name))
        .map((name) => name.slice(0, name.lastIndexOf('.')))
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
        const native = await fileDetails(locations.native);
        const meta = await fileDetails(locations.meta);
        // Keep malformed manifests for inspection. Never follow links or infer
        // a final filename from unvalidated metadata.
        if (meta && !record) return;
        if (record?.metadata.postId) return;
        const metadata = record?.metadata;
        const lastActivity = Math.max(
          meta?.mtimeMs || 0,
          part?.mtimeMs || 0,
          native?.mtimeMs || 0,
          Number(metadata?.updatedAt || metadata?.createdAt) || 0
        );
        if (lastActivity > now() - expiryMs) return;
        if (part && !part.isFile()) return;
        if (native && !native.isFile()) return;
        const finalPath = metadata
          ? path.join(directory, `${id}-${metadata.name}`)
          : null;
        const final = finalPath ? await fileDetails(finalPath) : null;
        if (final && (!final.isFile() || (await isPublished(id, metadata))))
          return;
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
        if (native) {
          await rm(locations.native);
          recoveredBytes += allocatedBytes(native);
        }
        if (meta) await rm(locations.meta);
        if (part || meta || final || native) removed += 1;
      });
    }
    return { removed, recoveredBytes };
  }
  return { inspect, assertCapacity, sweep };
}
