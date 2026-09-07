import FlamingoMediaUpload from '../models/FlamingoMediaUpload.js';
import { randomUUID } from 'node:crypto';
import { flamingoObjectStorage } from '../utils/flamingoObjectStorage.js';

const failure = (message, status = 409) =>
  Object.assign(new Error(message), { status, retryable: false });
const chunkBytes = 5 * 1024 ** 2;
export function createObjectUploads({
  sessions = FlamingoMediaUpload,
  storage = flamingoObjectStorage
} = {}) {
  async function load(id, hash) {
    const session = await sessions
      .findById(id)
      .select('+ownerTokenHash')
      .lean();
    if (!session)
      throw failure('Upload session expired. Select the file again.', 410);
    if (session.ownerTokenHash !== hash)
      throw failure('This upload belongs to another session.', 403);
    return session;
  }
  const length = (session, number) => {
    if (
      !Number.isSafeInteger(number) ||
      number < 1 ||
      number > Math.ceil(session.details.size / session.chunkBytes)
    )
      throw failure('Invalid upload part.');
    return Math.min(
      session.chunkBytes,
      session.details.size - (number - 1) * session.chunkBytes
    );
  };
  return {
    load,
    async start(details) {
      const { id, ownerTokenHash, ...metadata } = details;
      let session = await sessions
        .findById(id)
        .select('+ownerTokenHash')
        .lean();
      if (session) {
        if (session.ownerTokenHash !== ownerTokenHash)
          throw failure('This upload belongs to another session.', 403);
        if (
          session.details.name !== metadata.name ||
          session.details.size !== metadata.size ||
          session.details.restorePostId !== metadata.restorePostId
        )
          throw failure('This upload identifier is already in use.');
        session = await sessions
          .findByIdAndUpdate(
            id,
            {
              $set: {
                'details.text': metadata.text,
                'details.title': metadata.title,
                'details.premium': metadata.premium,
                'details.priceTpg': metadata.priceTpg
              }
            },
            { new: true }
          )
          .select('+ownerTokenHash')
          .lean();
      } else {
        const store = storage();
        // Client-selected ids are public in media URLs. A fresh opaque key
        // also prevents expired/deleted sessions from reusing another object.
        const key = `wall/${id}/${randomUUID()}/${metadata.name}`;
        const multipartId = await store.begin(
          key,
          metadata.type,
          metadata.size
        );
        try {
          session = await sessions.create({
            _id: id,
            ownerTokenHash,
            details: metadata,
            key,
            bucket: store.bucket,
            multipartId,
            chunkBytes,
            parts: {}
          });
          session = session.toObject?.() || session;
        } catch (error) {
          await store
            .abort({ key, bucket: store.bucket, multipartId })
            .catch(() => {});
          if (error.code !== 11000) throw error;
          session = await load(id, ownerTokenHash);
          if (
            session.details.name !== metadata.name ||
            session.details.size !== metadata.size ||
            session.details.restorePostId !== metadata.restorePostId
          )
            throw failure('This upload identifier is already in use.');
        }
      }
      return {
        session,
        response: {
          transport: 's3-multipart',
          uploadId: id,
          chunkBytes: session.chunkBytes,
          receivedOffsets: Object.keys(session.parts || {}).map(
            (number) => (Number(number) - 1) * session.chunkBytes
          )
        }
      };
    },
    async sign(id, hash, number) {
      const session = await load(id, hash);
      if (session.postId) throw failure('This upload is already published.');
      const size = length(session, number);
      return {
        url: await storage().signPart(session, number, size),
        partNumber: number,
        size
      };
    },
    async acknowledge(id, hash, number, etag) {
      const session = await load(id, hash);
      const size = length(session, number);
      if (session.postId) throw failure('This upload is already published.');
      if (typeof etag !== 'string' || !etag || etag.length > 200)
        throw failure('The upload receipt is missing. Retry this part.');
      const actual = await storage().part(session, number);
      if (!actual || actual.Size !== size || actual.ETag !== etag)
        throw failure('The uploaded part was not confirmed. Retry this part.');
      await sessions.updateOne(
        { _id: id, ownerTokenHash: hash },
        {
          $set: {
            [`parts.${number}`]: { number, size, etag },
            updatedAt: new Date()
          }
        }
      );
      return { received: size };
    },
    async finish(session) {
      const store = storage();
      let object = await store.head(session.key, session.bucket);
      if (!object) {
        const count = Math.ceil(session.details.size / session.chunkBytes);
        const parts = Object.values(session.parts || {}).sort(
          (a, b) => a.number - b.number
        );
        if (
          parts.length !== count ||
          parts.some(
            (part, index) =>
              part.number !== index + 1 ||
              part.size !== length(session, part.number)
          )
        )
          throw failure(
            'The file has not finished uploading. Resume to continue.'
          );
        const actual = await store.parts(session);
        if (
          actual.length !== parts.length ||
          parts.some(
            (part) =>
              !actual.some(
                (item) =>
                  item.PartNumber === part.number &&
                  item.ETag === part.etag &&
                  item.Size === part.size
              )
          )
        )
          throw failure('An uploaded part changed. Retry the original file.');
        object = await store.complete(session, parts);
      }
      if (!object || Number(object.ContentLength) !== session.details.size)
        throw failure('The stored media does not match the selected file.');
      return object;
    },
    async published(session, postId) {
      await sessions.updateOne(
        { _id: session._id, ownerTokenHash: session.ownerTokenHash },
        { $set: { postId, expiresAt: new Date(Date.now() + 7 * 86400000) } }
      );
    },
    async recover({ isBusy, withLock, referenced }) {
      const expired = await sessions
        .find({
          postId: { $exists: false },
          updatedAt: { $lt: new Date(Date.now() - 48 * 3600000) }
        })
        .limit(50)
        .lean();
      for (const candidate of expired) {
        if (isBusy(candidate._id)) continue;
        await withLock(candidate._id, async () => {
          const current = await sessions.findById(candidate._id).lean();
          if (
            !current ||
            current.postId ||
            new Date(current.updatedAt).getTime() > Date.now() - 48 * 3600000 ||
            (await referenced(current.key))
          )
            return;
          const store = storage();
          await store.abort(current);
          // Never automatically remove a completed original after a failed
          // database save. Keep its manifest available for recovery/review.
          if (await store.head(current.key, current.bucket)) return;
          await sessions.deleteOne({
            _id: current._id,
            postId: { $exists: false }
          });
        });
      }
    }
  };
}
export const objectUploads = createObjectUploads();
