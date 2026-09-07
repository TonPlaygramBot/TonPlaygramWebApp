import {
  S3Client,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const objectStorageEnabled = (env = process.env) =>
  env.FLAMINGO_MEDIA_STORAGE === 's3';
const unavailable = (message, code = 'WALL_OBJECT_STORAGE_UNAVAILABLE') =>
  Object.assign(new Error(message), { status: 503, code, retryable: false });
export function objectStorageConfig(env = process.env) {
  const required = [
    'FLAMINGO_S3_ENDPOINT',
    'FLAMINGO_S3_BUCKET',
    'FLAMINGO_S3_ACCESS_KEY_ID',
    'FLAMINGO_S3_SECRET_ACCESS_KEY'
  ];
  if (required.some((key) => !String(env[key] || '').trim())) {
    throw unavailable(
      'Media storage is not connected yet. Your file is kept; the service owner needs to connect the media bucket.',
      'WALL_OBJECT_STORAGE_NOT_CONFIGURED'
    );
  }
  let endpoint;
  try {
    endpoint = new URL(env.FLAMINGO_S3_ENDPOINT);
  } catch {
    throw unavailable(
      'The media storage connection needs attention.',
      'WALL_OBJECT_STORAGE_NOT_CONFIGURED'
    );
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  ) {
    throw unavailable(
      'The media storage connection needs attention.',
      'WALL_OBJECT_STORAGE_NOT_CONFIGURED'
    );
  }
  return {
    endpoint: endpoint.origin,
    bucket: env.FLAMINGO_S3_BUCKET,
    region: env.FLAMINGO_S3_REGION || 'auto',
    credentials: {
      accessKeyId: env.FLAMINGO_S3_ACCESS_KEY_ID,
      secretAccessKey: env.FLAMINGO_S3_SECRET_ACCESS_KEY
    }
  };
}

const missing = (error) =>
  [404].includes(error?.$metadata?.httpStatusCode) ||
  ['NotFound', 'NoSuchKey', 'NoSuchUpload'].includes(error?.name);
export function createFlamingoObjectStorage({
  config,
  client,
  sign = getSignedUrl
} = {}) {
  config ||= objectStorageConfig();
  client ||= new S3Client({
    ...config,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 3
  });
  const args = (key, bucket = config.bucket) => ({ Bucket: bucket, Key: key });
  const send = async (command) => {
    try {
      return await client.send(command);
    } catch (error) {
      if (missing(error)) throw error;
      // SDK errors/URLs can contain signed credentials. Return a stable code
      // and a safe message, never the raw provider response to the browser.
      const status = error?.$metadata?.httpStatusCode;
      throw Object.assign(
        unavailable(
          status === 403
            ? 'The media storage connection needs permission to upload files.'
            : 'Media storage could not be reached. Keep your file selected and retry.'
        ),
        { retryable: status !== 403, cause: error }
      );
    }
  };
  const head = async (key, bucket) => {
    try {
      return await send(new HeadObjectCommand(args(key, bucket)));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  };
  return {
    bucket: config.bucket,
    async health() {
      await send(new HeadBucketCommand({ Bucket: config.bucket }));
      return {
        provider: 's3',
        reachable: true,
        durability: { persistent: true, required: true },
        capacity: 'provider-managed'
      };
    },
    head,
    async begin(key, contentType, size) {
      const result = await send(
        new CreateMultipartUploadCommand({
          ...args(key),
          ContentType: contentType,
          Metadata: { 'wall-size': String(size) }
        })
      );
      return result.UploadId;
    },
    async signPart(session, number, size) {
      return sign(
        client,
        new UploadPartCommand({
          ...args(session.key, session.bucket),
          UploadId: session.multipartId,
          PartNumber: number,
          ContentLength: size
        }),
        { expiresIn: 900, signableHeaders: new Set(['content-length']) }
      );
    },
    async parts(session) {
      const all = [];
      let marker;
      do {
        const page = await send(
          new ListPartsCommand({
            ...args(session.key, session.bucket),
            UploadId: session.multipartId,
            PartNumberMarker: marker
          })
        );
        all.push(...(page.Parts || []));
        marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
      } while (marker);
      return all;
    },
    async part(session, number) {
      const page = await send(
        new ListPartsCommand({
          ...args(session.key, session.bucket),
          UploadId: session.multipartId,
          PartNumberMarker: number - 1,
          MaxParts: 1
        })
      );
      return page.Parts?.find((part) => part.PartNumber === number);
    },
    async complete(session, parts) {
      const stored = await head(session.key, session.bucket);
      if (stored) return stored; // The completion response may have been lost.
      try {
        await send(
          new CompleteMultipartUploadCommand({
            ...args(session.key, session.bucket),
            UploadId: session.multipartId,
            MultipartUpload: {
              Parts: parts.map((part) => ({
                PartNumber: part.number,
                ETag: part.etag
              }))
            }
          })
        );
      } catch (error) {
        const confirmed = await head(session.key, session.bucket);
        if (!confirmed) throw error;
      }
      return head(session.key, session.bucket);
    },
    async abort(session) {
      try {
        await send(
          new AbortMultipartUploadCommand({
            ...args(session.key, session.bucket),
            UploadId: session.multipartId
          })
        );
      } catch (error) {
        if (!missing(error)) throw error;
      }
    },
    remove: (key, bucket) => send(new DeleteObjectCommand(args(key, bucket))),
    async readUrl(
      key,
      bucket,
      { name = 'media', download = false, type } = {}
    ) {
      const filename = String(name).replace(/["\\\r\n]/g, '_');
      const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
      return sign(
        client,
        new GetObjectCommand({
          ...args(key, bucket),
          ResponseContentType: type,
          ResponseContentDisposition: `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
        }),
        { expiresIn: download ? 300 : 3600 }
      );
    },
    put: (key, body, contentType = 'application/octet-stream', size) =>
      send(
        new PutObjectCommand({
          ...args(key),
          Body: body,
          ContentType: contentType,
          ContentLength: size
        })
      )
  };
}

let storage;
export const flamingoObjectStorage = () =>
  (storage ||= createFlamingoObjectStorage());

export const objectAttachment = (session, original) => ({
  ...(original || {
    name: session.details.name,
    size: session.details.size,
    type: session.details.type,
    duration: session.details.duration,
    premium: session.details.premium && session.details.priceTpg > 0,
    priceTpg: session.details.premium ? session.details.priceTpg : 0
  }),
  databaseFileId: undefined,
  url: `/api/flamingo-wall/files/${session._id}-${session.details.name}`,
  objectKey: session.key,
  objectBucket: session.bucket
});
