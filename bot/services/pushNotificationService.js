import http2 from 'http2';
import { createPrivateKey, sign } from 'crypto';

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function createApnsJwt() {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) return null;
  const header = encode(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = encode(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363'
  });
  return `${header}.${claims}.${encode(signature)}`;
}

async function sendApns(token, notification, data) {
  const jwt = createApnsJwt();
  const topic = process.env.APNS_BUNDLE_ID;
  if (!jwt || !topic) return false;
  const host = process.env.APNS_PRODUCTION === 'false'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
  const client = http2.connect(host);
  return new Promise((resolve) => {
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json'
    });
    request.setEncoding('utf8');
    request.on('response', (headers) => resolve(Number(headers[':status']) === 200));
    request.on('error', () => resolve(false));
    request.on('close', () => client.close());
    request.end(JSON.stringify({ aps: { alert: notification, sound: 'default', 'content-available': 1 }, ...data }));
  });
}

async function sendFcm(token, notification, data) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) return false;
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { authorization: `key=${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      to: token,
      priority: 'high',
      notification: { ...notification, sound: 'default', android_channel_id: data?.type === 'friendCall' ? 'incoming_calls' : 'default' },
      data
    })
  });
  return response.ok;
}

export async function sendPushNotifications(pushTokens = [], notification, data = {}) {
  const results = await Promise.allSettled(pushTokens.map((entry) => {
    if (entry?.platform === 'ios') return sendApns(entry.token, notification, data);
    return sendFcm(entry?.token, notification, data);
  }));
  return results.filter((result) => result.status === 'fulfilled' && result.value).length;
}
