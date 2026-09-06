const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const flamingoWallPageSize = value => Math.max(1, Math.min(Number.parseInt(value, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
export const encodeFlamingoWallCursor = post => post?._id && post?.createdAt ? Buffer.from(JSON.stringify({ createdAt: new Date(post.createdAt).toISOString(), id: String(post._id) })).toString('base64url') : null;
export const decodeFlamingoWallCursor = value => {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    const createdAt = new Date(cursor.createdAt);
    return cursor.id && !Number.isNaN(createdAt.getTime()) ? { createdAt, id: String(cursor.id) } : null;
  } catch { return null; }
};
export const flamingoWallCursorQuery = (cursor, objectId) => cursor ? { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: objectId(cursor.id) } }] } : {};
