import { OAuth, Connection } from './models.js';
import { creatorReturnPath } from '../../shared/socialApp.js';
import { connectionStatus, credentials, PROVIDERS } from './catalog.js';
import { random, digest, seal, unseal, cookies, setCookie, publicOrigin, issueSession, problem } from './security.js';
import { request, form, json, fb, metaVersion } from './http.js';

const configs = {
  google: ['https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', 'openid profile'],
  youtube: ['https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', 'openid profile https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube.upload'],
  facebook: [`https://www.facebook.com/${metaVersion()}/dialog/oauth`, `${fb()}/oauth/access_token`, 'pages_show_list pages_read_engagement pages_manage_posts publish_video'],
  instagram: ['https://www.instagram.com/oauth/authorize', 'https://api.instagram.com/oauth/access_token', 'instagram_business_basic instagram_business_content_publish'],
  tiktok: ['https://www.tiktok.com/v2/auth/authorize/', 'https://open.tiktokapis.com/v2/oauth/token/', 'user.info.basic video.publish'],
};
export const callback = p => `${publicOrigin()}/api/creator/oauth/${p}/callback`;
export async function beginOAuth(req, res, platform) {
  const status = connectionStatus(platform);
  if (!status.available || !configs[platform]) throw problem(503, status.setupMessage || 'This platform is unavailable.');
  const state = random(), binding = random(), verifier = random();
  await OAuth.create({ stateHash: digest(state), binding: digest(binding), platform, owner: req.creator?.owner, verifier, returnTo: creatorReturnPath(req.body?.returnTo), expiresAt: new Date(Date.now() + 600000) });
  setCookie(res, 'tpg_creator_oauth', binding, 600000);
  const url = new URL(configs[platform][0]);
  const args = { [platform === 'tiktok' ? 'client_key' : 'client_id']: credentials(platform).id, redirect_uri: callback(platform), response_type: 'code', scope: configs[platform][2], state };
  if (['facebook', 'instagram', 'tiktok'].includes(platform)) args.scope = args.scope.replaceAll(' ', ',');
  if (['google', 'youtube'].includes(platform)) Object.assign(args, { code_challenge: (await import('node:crypto')).createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  if (['google', 'youtube'].includes(platform)) Object.assign(args, { access_type: 'offline', prompt: 'consent' });
  if (platform === 'instagram') args.enable_fb_login = '0';
  url.search = new URLSearchParams(args).toString();
  return url.toString();
}
async function exchange(platform, code, verifier) {
  const c = credentials(platform);
  const args = { [platform === 'tiktok' ? 'client_key' : 'client_id']: c.id, client_secret: c.secret, redirect_uri: callback(platform), grant_type: 'authorization_code', code };
  if (['google', 'youtube'].includes(platform)) args.code_verifier = verifier;
  const options = form(args);
  let token = await request(configs[platform][1], options);
  if (platform === 'instagram' && Array.isArray(token.data)) token = token.data[0] || {};
  if (platform === 'instagram') {
    const u = new URL('https://graph.instagram.com/access_token');
    u.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: c.secret, access_token: token.access_token });
    token = { ...token, ...await request(u) };
  }
  if (platform === 'facebook') {
    token = { ...token, ...await request(`${fb()}/oauth/access_token`, form({ grant_type: 'fb_exchange_token', client_id: c.id, client_secret: c.secret, fb_exchange_token: token.access_token })) };
  }
  if (!token.access_token) throw problem(502, 'The platform did not return a connection.');
  return token;
}
export async function finishOAuth(req, res, platform) {
  if (platform !== 'google' && !Object.hasOwn(PROVIDERS, platform)) throw problem(400, 'This platform is not supported in Creator Studio.');
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const binding = cookies(req).tpg_creator_oauth;
  if (!state || !binding) throw problem(400, 'The connection expired. Please connect again.');
  const pending = await OAuth.findOneAndDelete({ stateHash: digest(state), binding: digest(binding), platform, expiresAt: { $gt: new Date() } });
  setCookie(res, 'tpg_creator_oauth', '', 0);
  if (!pending) throw problem(400, 'The connection expired. Please connect again.');
  if (pending.owner !== req.creator?.owner) throw problem(401, 'Sign in with the same Studio account and try again.');
  res.locals ||= {};
  res.locals.creatorReturnTo = creatorReturnPath(pending.returnTo);
  if (req.query.error || typeof req.query.code !== 'string') throw problem(400, 'Connection cancelled. No new account was added.');
  const token = await exchange(platform, req.query.code, pending.verifier);
  const get = url => request(url, json('GET', token.access_token));
  if (platform === 'google') {
    const user = await get('https://openidconnect.googleapis.com/v1/userinfo');
    if (!user.sub) throw problem(401, 'Google could not verify your account.');
    issueSession(res, `google:${user.sub}`, user.name); return;
  }
  let accounts = [], identity;
  if (!pending.owner && platform === 'youtube') {
    const profile = await get('https://openidconnect.googleapis.com/v1/userinfo');
    if (typeof profile.sub !== 'string' || !/^[a-zA-Z0-9_-]{1,255}$/.test(profile.sub)) throw problem(401, 'Google could not verify your account.');
    identity = { owner: `google:${profile.sub}`, name: profile.name };
  }
  if (!pending.owner && platform === 'facebook') {
    const profile = await get(`${fb()}/me?fields=id,name`);
    if (!profile.id) throw problem(401, 'Facebook could not verify your account.');
    identity = { owner: `facebook:${digest(String(profile.id))}`, name: profile.name };
  }
  if (platform === 'youtube') {
    const data = await get('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true');
    accounts = (data.items || []).map(x => ({ id: x.id, name: x.snippet.title }));
  } else if (platform === 'facebook') {
    let next = `${fb()}/me/accounts?fields=id,name,access_token,tasks&limit=100`;
    for (let page = 0; next && page < 10; page++) {
      const data = await get(next);
      accounts.push(...(data.data || []).filter(x => x.tasks?.some(t => ['CREATE_CONTENT', 'MANAGE', 'PROFILE_PLUS_FULL_CONTROL'].includes(t))).map(x => ({ id: x.id, name: x.name, token: { access_token: x.access_token } })));
      const after = data.paging?.cursors?.after;
      next = data.paging?.next && after ? `${fb()}/me/accounts?fields=id,name,access_token,tasks&limit=100&after=${encodeURIComponent(after)}` : null;
    }
  } else if (platform === 'instagram') {
    const data = await get(`https://graph.instagram.com/${metaVersion()}/me?fields=user_id,username`);
    accounts = [{ id: data.user_id || data.id, name: data.username }];
  } else if (platform === 'tiktok') {
    const data = await get('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name'); accounts = [{ id: data.data?.user?.open_id, name: data.data?.user?.display_name }];
  }
  if (!accounts.length || accounts.some(x => !x.id)) throw problem(400, 'No eligible account was found. Check your platform account type and permissions.');
  if (!pending.owner && !identity && ['instagram', 'tiktok'].includes(platform)) {
    identity = { owner: `${platform}:${digest(String(accounts[0].id))}`, name: accounts[0].name };
  }
  const owner = pending.owner || identity?.owner;
  if (!owner) throw problem(401, 'The platform could not verify your account.');
  for (const account of accounts) {
    const ownToken = account.token || token;
    // Preserve an existing refresh token when a provider omits it on reconnection.
    const existing = await Connection.findOne({ owner, platform, providerId: String(account.id) }).select('+credentials');
    if (!ownToken.refresh_token && existing?.credentials) {
      try { ownToken.refresh_token = unseal(existing.credentials, owner).refresh_token; } catch { /* new grant can replace an invalid token */ }
    }
    await Connection.findOneAndUpdate({ owner, platform, providerId: String(account.id) }, { $set: { name: account.name || platform, credentials: seal(ownToken, owner), status: 'connected', expiresAt: ownToken.expires_in ? new Date(Date.now() + ownToken.expires_in * 1000) : null } }, { upsert: true, new: true });
  }
  if (!pending.owner) issueSession(res, owner, identity.name || accounts[0].name);
}
const refreshing = new Map();
export async function accessToken(connection) {
  if (!connection || connection.status !== 'connected') throw problem(401, 'Please reconnect this account.');
  const key = String(connection._id);
  if (refreshing.has(key)) return refreshing.get(key);
  const action = (async () => {
    let token = unseal(connection.credentials, connection.owner);
    if (!connection.expiresAt || +connection.expiresAt > Date.now() + 300000) return token.access_token;
    try {
      const p = connection.platform, c = credentials(p);
      let fresh;
      if (p === 'instagram') {
        const u = new URL('https://graph.instagram.com/refresh_access_token');
        u.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token.access_token });
        fresh = await request(u);
      } else {
        if (!token.refresh_token) throw problem(401, 'Please reconnect this account.');
        const args = { grant_type: 'refresh_token', refresh_token: token.refresh_token, [p === 'tiktok' ? 'client_key' : 'client_id']: c.id, client_secret: c.secret };
        const opts = form(args);
        fresh = await request(configs[p][1], opts);
      }
      if (!fresh.access_token) throw problem(401, 'Please reconnect this account.');
      token = { ...token, ...fresh };
      await Connection.updateOne({ _id: connection._id, status: 'connected' }, { credentials: seal(token, connection.owner), expiresAt: new Date(Date.now() + Number(fresh.expires_in || 3600) * 1000) });
      return token.access_token;
    } catch (error) {
      if (error.status === 401) await Connection.updateOne({ _id: connection._id }, { status: 'reconnect' });
      throw error;
    }
  })();
  refreshing.set(key, action);
  try { return await action; } finally { refreshing.delete(key); }
}
