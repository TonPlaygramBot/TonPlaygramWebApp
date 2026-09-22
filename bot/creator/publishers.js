import { createReadStream } from 'node:fs';
import { PROVIDERS } from './catalog.js';
import { accessToken } from './oauth.js';
import { request, json, form, fb, metaVersion } from './http.js';
import { mediaUrl, mediaPath } from './media.js';
import { problem } from './security.js';
export async function creatorInfo(connection) {
  if (!Object.hasOwn(PROVIDERS, connection.platform)) throw problem(400, 'This platform is no longer supported in Creator Studio.');
  const token = await accessToken(connection);
  const result = await request('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', json('POST', token, {}));
  if (!result.data?.privacy_level_options?.length) throw problem(400, 'TikTok is not accepting posts from this account right now.');
  return result.data;
}
export function validateContent(post, connection, media, info) {
  const p = PROVIDERS[connection.platform];
  const caption = post.overrides?.get?.(connection.platform) ?? post.overrides?.[connection.platform] ?? post.caption ?? '';
  if (!p?.post.length) throw problem(400, `${p?.name || 'This account'} supports live streaming only.`);
  if (Array.from(caption).length > p.limit) throw problem(400, `${p.name}: shorten the caption to ${p.limit} characters.`);
  if (!caption.trim() && !media) throw problem(400, 'Add a caption or media.');
  if (!p.post.includes(media?.mime || 'text')) throw problem(400, `${p.name}: choose ${p.post.filter(x => x !== 'text').join(', ') || 'text without a media attachment'}.`);
  if (connection.status !== 'connected') throw problem(400, `Reconnect ${connection.name} before publishing.`);
  if (connection.platform === 'youtube') {
    if (!post.title?.trim() || post.title.length > 100) throw problem(400, 'YouTube needs a title of 1–100 characters.');
    if (!['private', 'unlisted', 'public'].includes(post.settings?.youtubePrivacy) || typeof post.settings?.madeForKids !== 'boolean') throw problem(400, 'Choose YouTube visibility and whether this video is made for children.');
  }
  if (connection.platform === 'instagram' && media) {
    if (media.mime === 'image/jpeg' && (media.size > 8 * 1024 ** 2 || media.width / media.height < 0.8 || media.width / media.height > 1.91)) throw problem(400, 'Instagram photos must be up to 8 MB and between 4:5 and 1.91:1.');
    if (media.mime === 'video/mp4' && (media.duration < 3 || media.duration > 900)) throw problem(400, 'Instagram Reels must be between 3 seconds and 15 minutes.');
  }
  if (connection.platform === 'tiktok') {
    const t = post.settings?.tiktok;
    if (!t?.consent || !info?.privacy_level_options?.includes(t.privacy)) throw problem(400, 'Choose the TikTok audience and accept its posting terms.');
    if (!media?.duration || media.duration > info.max_video_post_duration_sec) throw problem(400, 'This video is longer than your TikTok account allows.');
    if (t.disclosure && !t.ownBrand && !t.branded) throw problem(400, 'Choose which brand this TikTok video promotes.');
    if (t.branded && t.privacy === 'SELF_ONLY') throw problem(400, 'Paid partnerships cannot use a private TikTok audience.');
    if ((t.comments && info.comment_disabled) || (t.duet && info.duet_disabled) || (t.stitch && info.stitch_disabled)) throw problem(400, 'TikTok interaction permissions changed. Refresh the account options.');
  }
  return caption;
}
export async function publishStep(post, delivery, connection, media) {
  const p = connection.platform;
  if (!Object.hasOwn(PROVIDERS, p)) throw problem(400, 'This platform is no longer supported in Creator Studio.');
  const info = p === 'tiktok' && !delivery.externalId ? await creatorInfo(connection) : null;
  const caption = delivery.externalId ? (post.overrides?.get?.(p) ?? post.caption) : validateContent(post, connection, media, info);
  const token = await accessToken(connection);
  const url = media ? mediaUrl(media) : null;
  const wait = (externalId, stage) => ({ status: 'processing', externalId, stage, nextAt: new Date(Date.now() + 15000) });
  const done = (externalId, link) => ({ status: 'published', externalId: String(externalId), url: link || '', message: 'Published' });
  if (p === 'facebook') {
    if (!delivery.externalId) {
      const endpoint = media ? media.mime.startsWith('video/') ? 'videos' : 'photos' : 'feed';
      const body = endpoint === 'videos' ? { file_url: url, description: caption, title: post.title } : endpoint === 'photos' ? { url, caption } : { message: caption };
      const data = await request(`${fb()}/${connection.providerId}/${endpoint}`, json('POST', token, body));
      const id = data.post_id || data.id;
      if (!id) throw problem(502, 'Facebook did not confirm this post. Check your Page before trying again.');
      return endpoint === 'videos' ? wait(id, 'video') : done(id, `https://www.facebook.com/${id}`);
    }
    const data = await request(`${fb()}/${delivery.externalId}?fields=status,permalink_url`, json('GET', token));
    if (data.status?.video_status === 'error') throw problem(400, 'Facebook could not process this video.');
    return data.status?.video_status === 'ready' ? done(delivery.externalId, data.permalink_url) : wait(delivery.externalId, 'video');
  }
  if (p === 'instagram') {
    const base = `https://graph.instagram.com/${metaVersion()}`;
    const edge = 'media';
    if (!delivery.externalId) {
      const body = { caption, ...(media.mime.startsWith('video/') ? { media_type: 'REELS', video_url: url } : { image_url: url }) };
      const data = await request(`${base}/${connection.providerId}/${edge}`, json('POST', token, body));
      if (!data.id) throw problem(502, 'The platform did not confirm this upload.');
      return wait(data.id, 'container');
    }
    const result = await request(`${base}/${delivery.externalId}?fields=status_code`, json('GET', token));
    const status = result.status_code || result.status;
    if (['ERROR', 'EXPIRED'].includes(status)) throw problem(400, 'The platform could not process this media. Check its format.');
    if (status !== 'FINISHED') return wait(delivery.externalId, 'container');
    const data = await request(`${base}/${connection.providerId}/${edge}_publish`, json('POST', token, { creation_id: delivery.externalId }));
    if (!data.id) throw problem(502, 'The platform did not confirm publication. Check your profile before trying again.');
    // Save success without an extra remote request that could fail after publishing.
    return done(data.id);
  }
  if (p === 'tiktok') {
    if (!delivery.externalId) {
      const t = post.settings.tiktok;
      const data = await request('https://open.tiktokapis.com/v2/post/publish/video/init/', json('POST', token, { post_info: { title: caption, privacy_level: t.privacy, disable_comment: !t.comments, disable_duet: !t.duet, disable_stitch: !t.stitch, brand_content_toggle: Boolean(t.disclosure && t.branded), brand_organic_toggle: Boolean(t.disclosure && t.ownBrand), is_aigc: Boolean(t.aiGenerated) }, source_info: { source: 'PULL_FROM_URL', video_url: url } }));
      if (!data.data?.publish_id) throw problem(502, 'TikTok did not confirm this upload.');
      return wait(data.data.publish_id, 'tiktok');
    }
    const data = await request('https://open.tiktokapis.com/v2/post/publish/status/fetch/', json('POST', token, { publish_id: delivery.externalId }));
    if (data.data?.status === 'FAILED') throw problem(400, 'TikTok could not publish this video. Check its format and your account permissions.');
    return data.data?.status === 'PUBLISH_COMPLETE' ? done(data.data.publicaly_available_post_id?.[0] || delivery.externalId) : wait(delivery.externalId, 'tiktok');
  }
  if (p === 'youtube') {
    if (delivery.externalId) {
      const data = await request(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(delivery.externalId)}`, json('GET', token));
      const status = data.items?.[0]?.status?.uploadStatus;
      if (['failed', 'rejected', 'deleted'].includes(status)) throw problem(400, 'YouTube could not process this video. Check YouTube Studio.');
      return status === 'processed' ? done(delivery.externalId, `https://youtu.be/${delivery.externalId}`) : wait(delivery.externalId, 'youtube');
    }
    const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { ...json('POST', token, { snippet: { title: post.title, description: caption }, status: { privacyStatus: post.settings.youtubePrivacy, selfDeclaredMadeForKids: post.settings.madeForKids } }, { 'X-Upload-Content-Type': media.mime, 'X-Upload-Content-Length': String(media.size) }), signal: AbortSignal.timeout(25000), redirect: 'error' });
    const location = start.headers.get('location');
    if (!start.ok || !location || new URL(location).hostname !== 'www.googleapis.com' || new URL(location).protocol !== 'https:') throw problem(502, 'YouTube could not start this upload.');
    const data = await request(location, { method: 'PUT', headers: { 'Content-Type': media.mime, 'Content-Length': String(media.size) }, body: createReadStream(mediaPath(media)), duplex: 'half', signal: AbortSignal.timeout(600000) });
    if (!data.id) throw problem(502, 'YouTube did not confirm this upload. Check YouTube Studio before trying again.');
    return wait(data.id, 'youtube');
  }
  throw problem(400, 'This destination does not support posting.');
}
