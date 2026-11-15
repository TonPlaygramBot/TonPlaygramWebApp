import { API_BASE_URL } from './api.js';
import { MAX_SECURE_ATTACHMENT_BYTES } from '../../../shared/secureMessagingProtocol.js';
import { loadGoogleCredential } from './google.js';
import { encryptMessage, decryptMessage, validateBundle, securityError } from './secureMessaging/crypto.js';
import { getStoredIdentity, getOrCreateIdentity, getOrPinPeer, getPeerPin, acceptChangedPeerKey, getIdentityForFingerprint, stageReplacementIdentity, activateIdentity } from './secureMessaging/storage.js';
export { MAX_SECURE_ATTACHMENT_BYTES, SECURE_MESSAGE_TTLS } from '../../../shared/secureMessagingProtocol.js';

function headers(json = true) {
  const result = { Accept: 'application/json' };
  if (json) result['Content-Type'] = 'application/json';
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) result['X-Telegram-Init-Data'] = initData;
  const googleToken = loadGoogleCredential();
  if (googleToken) result['X-Google-Id-Token'] = googleToken;
  // IDs are selection hints only. The server independently verifies the token.
  const accountId = window.localStorage?.getItem('accountId');
  if (accountId) result['X-Tpc-Account-Id'] = accountId;
  return result;
}
async function request(path, body, method = 'POST') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/social${path}`, {
      method, headers: headers(), cache: 'no-store', signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw securityError(String(data.code || (data.error === 'reauthentication_required' ? data.error : null) || (response.status === 401 ? 'SIGN_IN_REQUIRED' : 'REQUEST_FAILED')).toUpperCase(), data.message || data.error || 'Secure messaging is unavailable. Try again.');
    if (Array.isArray(data)) {
      const more = response.headers.get('x-social-has-more');
      if (more !== null) data.hasMore = more === 'true';
      data.nextCursor = response.headers.get('x-social-next-cursor') || data[0]?._id || null;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw securityError('NETWORK_TIMEOUT', 'The request timed out. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

const SAFE_PREVIEW_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp',
  'video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/aac']);
function safeAttachmentType(value) {
  const type = String(value || '').toLowerCase().split(';')[0].trim();
  return SAFE_PREVIEW_TYPES.has(type) ? type : 'application/octet-stream';
}

const lookup = (peerId) => request('/keys/lookup', { peerId });

export async function initializeSecureMessaging(selfId) {
  const own = await lookup(selfId);
  if (!own.accountId) throw securityError('INVALID_IDENTITY', 'Sign in again to set up secure messages.');
  const canonicalSelf = String(own.accountId);
  let identity = await getStoredIdentity(canonicalSelf);
  let ownBundle = own.bundle ? await validateBundle(own.bundle) : null;
  if (ownBundle && identity?.bundle.fingerprint !== ownBundle.fingerprint) {
    // Complete an explicitly requested replacement whose response was lost.
    const staged = await getIdentityForFingerprint(canonicalSelf, ownBundle.fingerprint);
    if (staged) identity = await activateIdentity(staged);
  }
  if (!ownBundle) {
    identity = identity || await getOrCreateIdentity(canonicalSelf);
    const registered = await request('/keys', { bundle: identity.bundle }, 'PUT');
    ownBundle = await validateBundle(registered.bundle || identity.bundle);
  }
  const isReady = Boolean(identity && identity.bundle.fingerprint === ownBundle.fingerprint);
  return { selfId: canonicalSelf, identity, ownFingerprint: ownBundle.fingerprint,
    isReady, securityReason: isReady ? null : 'DEVICE_KEY_UNAVAILABLE' };
}

export async function prepareConversation(selfId, peerId) {
  const own = await initializeSecureMessaging(selfId);
  const peer = await lookup(peerId);
  if (!peer.accountId || own.selfId === String(peer.accountId)) throw securityError('INVALID_CONVERSATION', 'Select a friend to start a conversation.');
  const canonicalPeer = String(peer.accountId);
  const ctx = {
    selfId: own.selfId, peerId: canonicalPeer, identity: own.identity,
    ownFingerprint: own.ownFingerprint, peerFingerprint: null,
    canSend: false, security: 'unavailable', securityReason: 'KEYS_NOT_READY',
    peerBundle: null, trustedPeerFingerprints: []
  };
  if (peer.bundle) {
    ctx.peerBundle = await validateBundle(peer.bundle);
    ctx.peerFingerprint = ctx.peerBundle.fingerprint;
    const pin = await getOrPinPeer(own.selfId, canonicalPeer, ctx.peerFingerprint);
    ctx.trustedPeerFingerprints = pin.trustedFingerprints;
    if (pin.fingerprint !== ctx.peerFingerprint) {
      ctx.securityReason = 'KEY_CHANGED';
      ctx.previousPeerFingerprint = pin.fingerprint;
    } else { ctx.canSend = true; ctx.security = 'encrypted'; ctx.securityReason = null; }
  }
  if (!own.isReady) {
    ctx.canSend = false; ctx.security = 'unavailable'; ctx.securityReason = 'DEVICE_KEY_UNAVAILABLE';
  }
  return ctx;
}

export async function resetConversationDeviceKey(ctx) {
  if (!ctx?.selfId || ctx.securityReason !== 'DEVICE_KEY_UNAVAILABLE') throw securityError('INVALID_KEY_RESET', 'Open the unavailable device key details before replacing it.');
  const candidate = await stageReplacementIdentity(ctx.selfId, ctx.ownFingerprint);
  const latest = await lookup(ctx.selfId);
  if (latest.bundle?.fingerprint !== candidate.bundle.fingerprint) {
    if (latest.bundle?.fingerprint !== ctx.ownFingerprint) throw securityError('KEY_CHANGED', 'Your account key changed again. Reopen this conversation.');
    await request('/keys', { bundle: candidate.bundle, expectedFingerprint: ctx.ownFingerprint }, 'PUT');
  }
  await activateIdentity(candidate);
  return prepareConversation(ctx.selfId, ctx.peerId);
}

export async function acceptPeerKeyChange(ctx) {
  if (!ctx?.peerBundle || ctx.securityReason !== 'KEY_CHANGED') throw securityError('INVALID_KEY', 'Reopen this conversation before verifying the changed key.');
  // Check directory again so a confirmation cannot accidentally trust a newer key.
  const latest = await lookup(ctx.peerId);
  const bundle = await validateBundle(latest.bundle);
  if (bundle.fingerprint !== ctx.peerFingerprint) throw securityError('KEY_CHANGED', 'This friend’s key changed again. Open the conversation and compare the new key.');
  const pin = await acceptChangedPeerKey(ctx.selfId, ctx.peerId, bundle.fingerprint, ctx.previousPeerFingerprint);
  return { ...ctx, trustedPeerFingerprints: pin.trustedFingerprints, canSend: true, security: 'encrypted', securityReason: null, previousPeerFingerprint: undefined };
}

async function legacyAttachment(item) {
  let attachment = item;
  if (typeof item === 'string') { try { attachment = JSON.parse(item); } catch { return null; } }
  if (!attachment?.url || !/^\/api\/social\/message-files\/[A-Za-z0-9._-]+$/.test(attachment.url)) return null;
  if (Number(attachment.size) > MAX_SECURE_ATTACHMENT_BYTES) throw securityError('LEGACY_ATTACHMENT_TOO_LARGE', 'This older attachment exceeds the 2 MB secure preview limit.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_BASE_URL}${attachment.url}`, { headers: headers(false), cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    if (Number(response.headers.get('content-length')) > MAX_SECURE_ATTACHMENT_BYTES) { controller.abort(); throw securityError('LEGACY_ATTACHMENT_TOO_LARGE', 'This older attachment exceeds the 2 MB secure preview limit.'); }
    // Bound even chunked responses; opening history must never buffer a legacy
    // 1 GB upload into a phone's memory.
    const reader = response.body?.getReader();
    let blob;
    if (reader) {
      const chunks = []; let length = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_SECURE_ATTACHMENT_BYTES) { await reader.cancel(); throw securityError('LEGACY_ATTACHMENT_TOO_LARGE', 'This older attachment exceeds the 2 MB secure preview limit.'); }
        chunks.push(value);
      }
      blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
    } else {
      blob = await response.blob();
      if (blob.size > MAX_SECURE_ATTACHMENT_BYTES) throw securityError('LEGACY_ATTACHMENT_TOO_LARGE', 'This older attachment exceeds the 2 MB secure preview limit.');
    }
    const type = safeAttachmentType(attachment.type || blob.type);
    return { name: attachment.name || 'attachment', type,
      size: blob.size, url: URL.createObjectURL(new Blob([blob], { type })) };
  } finally { clearTimeout(timeout); }
}

export async function decryptMessages(ctx, records) {
  if (!Array.isArray(records)) return [];
  const results = [];
  for (const record of records) {
    if (record.deletedAt || (record.expiresAt && Date.parse(record.expiresAt) <= Date.now())) continue;
    if (!record.envelope) {
      // Old plaintext records stay visibly distinguished and are never re-sent.
      let attachment = null; let attachmentUnavailable = '';
      try { attachment = await legacyAttachment(record.attachment); } catch (error) { attachmentUnavailable = error.message || 'This older attachment could not be loaded.'; }
      results.push({ ...record, legacy: true, attachment, attachmentUnavailable });
      continue;
    }
    try {
      const ownFingerprint = record.envelope.from === ctx.selfId ? record.envelope.senderFingerprint : record.envelope.recipientFingerprint;
      const identity = ctx.identity?.bundle.fingerprint === ownFingerprint ? ctx.identity : await getIdentityForFingerprint(ctx.selfId, ownFingerprint);
      if (!identity) throw securityError('DEVICE_KEY_UNAVAILABLE', 'This message was encrypted for another device.');
      const decoded = await decryptMessage(identity, ctx.peerId, record.envelope, { trustedPeerFingerprints: ctx.trustedPeerFingerprints });
      const message = { ...record, attachment: null, replyTo: null, ...decoded, from: record.envelope.from, to: record.envelope.to, legacy: false };
      if (decoded.attachment) {
        const file = decoded.attachment;
        const type = safeAttachmentType(file.type);
        message.attachment = { name: file.name, type, size: file.size,
          url: URL.createObjectURL(new Blob([file.data], { type })) };
      }
      results.push(message);
    } catch (error) {
      if (error.code === 'MESSAGE_EXPIRED') continue;
      results.push({ ...record, text: error.code === 'DEVICE_KEY_UNAVAILABLE' ? 'This message was encrypted for another device key.' : 'Unable to verify or decrypt this message. Check your security keys.', attachment: null, replyTo: null, decryptionError: error.code || 'DECRYPTION_FAILED', legacy: false });
    }
  }
  return results;
}

export async function loadMessages(ctx, { before, limit = 10 } = {}) {
  const records = await request('/messages', { telegramId: ctx.selfId, withId: ctx.peerId, ...(before ? { before } : {}), limit });
  const decoded = await decryptMessages(ctx, records);
  decoded.hasMore = typeof records.hasMore === 'boolean' ? records.hasMore : records.length >= limit;
  decoded.nextCursor = records.nextCursor || records[0]?._id || null;
  return decoded;
}

export async function sendSecureMessage(ctx, payload) {
  if (!ctx?.canSend || !ctx.identity) throw securityError(ctx?.securityReason || 'KEYS_NOT_READY', 'Secure messaging is not ready. Check the conversation’s security details.');
  // Respect key changes accepted in another tab and refresh the recipient's key
  // before encryption. No plaintext fallback or automatic key replacement.
  const pin = await getPeerPin(ctx.selfId, ctx.peerId);
  if (pin?.fingerprint !== ctx.peerFingerprint) throw securityError('KEY_CHANGED', 'Your trusted security key changed. Reopen the conversation.');
  const latest = await lookup(ctx.peerId);
  const bundle = await validateBundle(latest.bundle);
  if (bundle.fingerprint !== ctx.peerFingerprint) throw securityError('KEY_CHANGED', 'This friend’s security key changed. Compare it before sending.');
  const envelope = await encryptMessage(ctx.identity, bundle, { ...payload, to: ctx.peerId });
  const record = await request('/send-message', { envelope });
  const [message] = await decryptMessages(ctx, [record]);
  if (!message || message.decryptionError) throw securityError('DECRYPTION_FAILED', 'The sent message could not be verified. Reopen the conversation before retrying.');
  return message;
}

export function deleteSecureMessage(ctx, id, scope = 'me') {
  if (!id || !['me', 'everyone'].includes(scope)) throw securityError('INVALID_DELETE', 'Choose how to delete this message.');
  return request(`/messages/${encodeURIComponent(id)}/delete`, { scope, telegramId: ctx.selfId });
}
export function clearSecureConversation(ctx, scope = 'me') {
  if (scope !== 'me') throw securityError('INVALID_DELETE', 'Clear conversation removes your copy only.');
  return request('/conversation/clear', { withId: ctx.peerId, scope, telegramId: ctx.selfId });
}
export function releaseMessageAttachments(records) {
  for (const message of records || []) if (message?.attachment?.url?.startsWith('blob:')) URL.revokeObjectURL(message.attachment.url);
}
