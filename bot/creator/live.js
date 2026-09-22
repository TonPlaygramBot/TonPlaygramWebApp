import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Connection, Live } from './models.js';
import { accessToken } from './oauth.js';
import { request, json, fb } from './http.js';
import { problem, seal, unseal, publicOrigin } from './security.js';
const exec = promisify(execFile);
const active = new Map();
const reservations = new Set();
const maxStreams = () => Math.max(1, Math.min(4, Number(process.env.CREATOR_LIVE_MAX_SESSIONS) || 1));
export const liveEnabled = () => process.env.CREATOR_LIVE_ENABLED === 'true';
export function encoderArgs(target, portrait, quality) {
  const width = portrait ? (quality === '1080' ? 1080 : 720) : (quality === '1080' ? 1920 : 1280);
  const height = portrait ? (quality === '1080' ? 1920 : 1280) : (quality === '1080' ? 1080 : 720);
  return ['-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'pipe', '-format_whitelist', 'matroska,webm,mov', '-i', 'pipe:0', '-map', '0:v:0', '-map', '0:a:0?', '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`, '-c:v', 'libx264', '-threads', '1', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-b:v', quality === '1080' ? '4500k' : '2500k', '-maxrate', quality === '1080' ? '4500k' : '2500k', '-bufsize', '5000k', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'flv', '-flvflags', 'no_duration_filesize', target];
}
export function validIngest(target, platform) {
  try {
    const url = new URL(target);
    const suffixes = platform === 'youtube' ? ['.youtube.com'] : platform === 'facebook' ? ['.facebook.com'] : [];
    return ['rtmp:', 'rtmps:'].includes(url.protocol) && suffixes.some(suffix => url.hostname.endsWith(suffix)) && !url.username && !url.password;
  } catch { return false; }
}
async function prepareDestination(connection, options, checkpoint) {
  const token = await accessToken(connection), p = connection.platform;
  const remote = {};
  if (p === 'youtube') {
    const broadcast = await request('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', json('POST', token, { snippet: { title: options.title, scheduledStartTime: new Date(Date.now() + 5000).toISOString() }, status: { privacyStatus: options.privacy, selfDeclaredMadeForKids: options.madeForKids }, contentDetails: { enableAutoStart: true, enableAutoStop: true } }));
    remote.broadcast = broadcast.id; await checkpoint(remote);
    const stream = await request('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', json('POST', token, { snippet: { title: options.title }, cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: options.quality === '1080' ? '1080p' : '720p' } }));
    remote.stream = stream.id; await checkpoint(remote);
    await request(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id&id=${encodeURIComponent(broadcast.id)}&streamId=${encodeURIComponent(stream.id)}`, json('POST', token, {}));
    const ingest = stream.cdn?.ingestionInfo;
    return { remote, target: `${ingest?.rtmpsIngestionAddress || ingest?.ingestionAddress}/${ingest?.streamName}` };
  }
  if (p === 'facebook') {
    const data = await request(`${fb()}/${connection.providerId}/live_videos`, json('POST', token, { title: options.title, status: 'LIVE_NOW' }));
    remote.broadcast = data.id; await checkpoint(remote);
    return { remote, target: data.secure_stream_url || data.stream_url };
  }
  throw problem(400, 'This account does not support automatic live streaming.');
}
export async function endDestination(connection, remote) {
  const token = await accessToken(connection);
  if (connection.platform === 'youtube' && remote.broadcast) {
    const result = await request(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status&id=${encodeURIComponent(remote.broadcast)}`, json('GET', token));
    const lifecycle = result.items?.[0]?.status?.lifeCycleStatus;
    if (['live', 'testing'].includes(lifecycle)) {
      await request(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=id&broadcastStatus=complete&id=${encodeURIComponent(remote.broadcast)}`, json('POST', token, {}));
    } else if (['created', 'ready'].includes(lifecycle)) {
      // Only discard a broadcast that never went live. Preserve completed archives.
      const result = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${encodeURIComponent(remote.broadcast)}`, { ...json('DELETE', token), signal: AbortSignal.timeout(15000) });
      if (!result.ok && result.status !== 404) throw problem(502, 'End this broadcast in YouTube Studio.');
    } else if (lifecycle && lifecycle !== 'complete' && lifecycle !== 'revoked') {
      throw problem(502, 'YouTube is changing broadcast state. Studio will check again shortly.');
    }
    if (remote.stream) await fetch(`https://www.googleapis.com/youtube/v3/liveStreams?id=${encodeURIComponent(remote.stream)}`, { ...json('DELETE', token), signal: AbortSignal.timeout(15000) });
  }
  if (connection.platform === 'facebook' && remote.broadcast) await request(`${fb()}/${remote.broadcast}`, json('POST', token, { end_live_video: true }));
}
async function confirmed(connection, remote) {
  const token = await accessToken(connection);
  if (connection.platform === 'youtube') {
    const r = await request(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status&id=${encodeURIComponent(remote.broadcast)}`, json('GET', token));
    return r.items?.[0]?.status?.lifeCycleStatus === 'live';
  }
  if (connection.platform === 'facebook') {
    const r = await request(`${fb()}/${remote.broadcast}?fields=status`, json('GET', token)); return r.status === 'LIVE';
  }
  return false;
}
export function liveSummary(state) {
  return { id: state.id, title: state.title, status: state.stopping ? 'ending' : 'on-air', destinations: state.destinations.map(d => ({ id: d.connectionId, name: d.name, platform: d.platform, status: d.status })) };
}
export function currentLive(owner) { return [...active.values()].find(s => s.owner === owner); }
export async function createLive(owner, options) {
  if (!liveEnabled()) throw problem(503, 'Live broadcasting is being prepared. You can still test your camera.');
  if (currentLive(owner) || reservations.has(owner)) throw problem(409, 'You already have an active broadcast. End it before starting another.');
  if (active.size + reservations.size >= maxStreams()) throw problem(503, 'The live studio is busy. Please try again shortly.');
  if (!options.title?.trim() || options.title.length > 100 || !Array.isArray(options.targets) || options.targets.length < 1 || options.targets.length > 2 || options.targets.some(x => !/^[a-f0-9]{24}$/.test(x)) || new Set(options.targets).size !== options.targets.length) throw problem(400, 'Add a title and choose a YouTube channel and/or Facebook Page.');
  if (!['private', 'unlisted', 'public'].includes(options.privacy) || typeof options.madeForKids !== 'boolean' || !['720', '1080'].includes(options.quality)) throw problem(400, 'Choose the broadcast quality, YouTube visibility and audience.');
  reservations.add(owner);
  let state;
  try {
    await exec('ffmpeg', ['-version'], { timeout: 5000, maxBuffer: 65536 });
    const connections = await Connection.find({ _id: { $in: options.targets }, owner, status: 'connected', platform: { $in: ['youtube', 'facebook'] } }).select('+credentials');
    if (connections.length !== options.targets.length) throw problem(400, 'Reconnect the selected live accounts.');
    if (new Set(connections.map(c => c.platform)).size !== connections.length) throw problem(400, 'Choose one account per platform for this broadcast.');
    const doc = await Live.create({ owner, title: options.title.trim(), status: 'starting', heartbeat: new Date(), destinations: connections.map(c => ({ connectionId: String(c._id), platform: c.platform, remote: {} })) });
    state = { id: String(doc._id), owner, title: options.title.trim(), destinations: [], lastChunk: Date.now(), socket: null };
    active.set(state.id, state);
    for (const connection of connections) {
      const dest = { connection, connectionId: String(connection._id), platform: connection.platform, name: connection.name, remote: {}, status: 'connecting' };
      state.destinations.push(dest);
      const prepared = await prepareDestination(connection, options, async remote => {
        dest.remote = { ...remote };
        await Live.updateOne({ _id: state.id, 'destinations.connectionId': dest.connectionId }, { $set: { 'destinations.$.remote': remote } });
      });
      if (!validIngest(prepared.target, connection.platform)) throw problem(502, 'The platform returned an unsupported broadcast address.');
      dest.target = prepared.target; dest.options = options; dest.remote = prepared.remote;
    }
    state.lastChunk = Date.now();
    state.watchdog = setInterval(() => {
      if (Date.now() - state.lastChunk > 20000) void stopLive(owner, state.id);
    }, 5000); state.watchdog.unref();
    await Live.updateOne({ _id: state.id }, { status: 'ready', heartbeat: new Date() });
    return { ...liveSummary(state), ticket: seal({ owner, exp: Date.now() + 30000 }, `live:${state.id}`) };
  } catch (error) {
    if (state) await stopLive(owner, state.id);
    throw error.publicMessage ? error : problem(503, 'The broadcast could not start. Please try again later.');
  } finally { reservations.delete(owner); }
}
export async function stopLive(owner, id) {
  const state = active.get(id);
  if (!state || state.owner !== owner) return;
  if (state.stopping) return state.stopPromise;
  state.stopping = true;
  state.stopPromise = (async () => {
    clearInterval(state.watchdog); clearInterval(state.monitor);
    for (const dest of state.destinations) {
      dest.process?.stdin.destroy(); dest.process?.kill('SIGTERM');
      if (dest.process) { const timer = setTimeout(() => dest.process?.kill('SIGKILL'), 3000); timer.unref(); }
      dest.status = 'ended';
    }
    state.socket?.emit('status', liveSummary(state));
    const results = await Promise.allSettled(state.destinations.map(d => endDestination(d.connection, d.remote)));
    const needsReview = results.some(r => r.status === 'rejected');
    await Live.updateOne({ _id: id }, { status: needsReview ? 'cleanup-required' : 'ended', heartbeat: new Date() }).catch(() => {});
    state.socket?.emit('ended', { needsReview }); state.socket?.disconnect(true);
    active.delete(id);
  })();
  return state.stopPromise;
}
export function attachLive(io) {
  const namespace = io.of('/creator-live');
  namespace.use((socket, next) => {
    let user;
    try { user = unseal(socket.handshake.auth?.ticket, `live:${socket.handshake.auth?.broadcastId}`); } catch { /* invalid ticket */ }
    const origin = socket.handshake.headers.origin;
    if (!user || user.exp < Date.now() || origin !== publicOrigin()) return next(new Error('Sign in to Creator Studio again.'));
    socket.data.creator = user; next();
  });
  namespace.on('connection', socket => {
    const state = active.get(String(socket.handshake.auth?.broadcastId));
    if (!state || state.owner !== socket.data.creator.owner || state.socket || state.stopping) return socket.disconnect(true);
    state.socket = socket; state.lastChunk = Date.now();
    for (const dest of state.destinations) {
      dest.process = spawn('ffmpeg', encoderArgs(dest.target, dest.options.portrait !== false, dest.options.quality), { stdio: ['pipe', 'ignore', 'ignore'], shell: false });
      dest.target = undefined; // Keys never enter logs, responses, or socket status.
      dest.process.stdin.on('error', () => { dest.status = 'failed'; });
      dest.process.on('error', () => { dest.status = 'failed'; });
      dest.process.on('exit', () => {
        if (!state.stopping) { dest.status = 'failed'; socket.emit('status', liveSummary(state)); }
        if (!state.stopping && state.destinations.every(d => d.status === 'failed')) void stopLive(state.owner, state.id);
      });
    }
    let receiving = false, sequence = 0;
    socket.on('chunk', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const bytes = payload?.bytes;
      if (receiving || payload?.sequence !== sequence || !Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 512 * 1024 || state.stopping) { reply({ error: 'Broadcast connection interrupted.' }); void stopLive(state.owner, state.id); return; }
      const outputs = state.destinations.filter(d => d.process && d.status !== 'failed');
      if (!outputs.length || outputs.some(d => d.process.stdin.writableLength > 4 * 1024 ** 2)) { reply({ error: 'Connection is too slow. Restart at 720p.' }); void stopLive(state.owner, state.id); return; }
      receiving = true; state.lastChunk = Date.now(); sequence++;
      Promise.all(outputs.map(d => new Promise(resolve => {
        d.process.stdin.write(bytes, error => { if (error) d.status = 'failed'; else if (d.status === 'connecting') d.status = 'sending'; resolve(); });
      }))).then(() => { receiving = false; reply({ ok: true }); });
    });
    let monitoring = false;
    state.monitor = setInterval(async () => {
      if (monitoring || state.stopping) return; monitoring = true;
      try {
        await Live.updateOne({ _id: state.id }, { status: 'active', heartbeat: new Date() });
        await Promise.allSettled(state.destinations.filter(d => d.status !== 'failed').map(async d => { d.status = await confirmed(d.connection, d.remote) ? 'live' : 'sending'; }));
        socket.emit('status', liveSummary(state));
      } catch { /* Keep the last verified destination state until the next check. */ } finally { monitoring = false; }
    }, 12000); state.monitor.unref();
    socket.emit('status', liveSummary(state));
    socket.on('disconnect', () => { void stopLive(state.owner, state.id); });
  });
  const recovery = setInterval(async () => {
    try {
      const stale = await Live.find({ status: { $in: ['starting', 'ready', 'active', 'cleanup-required'] }, heartbeat: { $lt: new Date(Date.now() - 120000) } }).limit(5);
      for (const record of stale) {
        if (active.has(String(record._id))) continue;
        const results = await Promise.allSettled(record.destinations.map(async d => {
          const c = await Connection.findOne({ _id: d.connectionId, owner: record.owner }).select('+credentials');
          if (c) await endDestination(c, d.remote || {});
        }));
        await Live.updateOne({ _id: record._id }, { status: results.some(r => r.status === 'rejected') ? 'cleanup-required' : 'ended', heartbeat: new Date() });
      }
    } catch { /* The next tick retries database/provider downtime. */ }
  }, 60000); recovery.unref();
  const shutdown = () => Promise.allSettled([...active.values()].map(s => stopLive(s.owner, s.id)));
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  return shutdown;
}
