import ActiveConnection from '../models/ActiveConnection.js';

export async function registerConnection({ userId, roomId = null, socketId }) {
  if (!userId) return;
  await ActiveConnection.findOneAndUpdate(
    { userId, roomId },
    { socketId, status: 'online', updatedAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
  console.log(`Connected user ${userId} room ${roomId ?? 'lobby'}`);
}

export async function removeConnection(socketId) {
  if (!socketId) return;
  const conn = await ActiveConnection.findOneAndDelete({ socketId });
  if (conn) {
    console.log(`Disconnected user ${conn.userId} room ${conn.roomId ?? 'lobby'}`);
  }
}

export async function ping({ userId, roomId = null, status = 'online' }) {
  if (!userId) return;
  if (status === 'offline') {
    await ActiveConnection.deleteMany({ userId, roomId });
    return;
  }
  await ActiveConnection.findOneAndUpdate(
    { userId, roomId },
    { status, updatedAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function cleanup(ms = 60_000) {
  const cutoff = new Date(Date.now() - ms);
  await ActiveConnection.deleteMany({ updatedAt: { $lt: cutoff } });
}

export async function listOnline() {
  await cleanup();
  const rows = await ActiveConnection.find({ status: 'online' })
    .select('userId status')
    .lean();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.userId)) {
      map.set(r.userId, { id: r.userId, status: r.status });
    }
  }
  return Array.from(map.values());
}

export async function countOnline() {
  const list = await listOnline();
  return list.length;
}
