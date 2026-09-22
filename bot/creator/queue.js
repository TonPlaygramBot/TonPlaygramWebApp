import mongoose from 'mongoose';
import { Connection, Media, Post } from './models.js';
import { publishStep } from './publishers.js';
const terminal = ['published', 'failed', 'attention', 'cancelled'];
export function summarize(deliveries) {
  if (!deliveries.length) return 'draft';
  if (deliveries.every(d => d.status === 'published')) return 'published';
  if (deliveries.every(d => terminal.includes(d.status))) return deliveries.some(d => d.status === 'published') ? 'partial' : deliveries.every(d => d.status === 'cancelled') ? 'cancelled' : 'failed';
  return 'queued';
}
export async function runDelivery(post, delivery) {
  const now = new Date();
  const claimed = await Post.findOneAndUpdate({ _id: post._id, status: { $in: ['queued', 'scheduled'] }, deliveries: { $elemMatch: { _id: delivery._id, status: delivery.status, nextAt: { $lte: now } } } }, { $set: { 'deliveries.$.status': 'sending', 'deliveries.$.startedAt': now }, $inc: { 'deliveries.$.attempts': 1 } });
  if (!claimed) return;
  let result;
  try {
    if (delivery.attempts >= 120) throw Object.assign(new Error(), { status: 400, publicMessage: 'Processing is taking longer than expected. Check the platform before retrying.' });
    const connection = await Connection.findOne({ _id: delivery.connectionId, owner: post.owner }).select('+credentials');
    if (!connection) throw Object.assign(new Error(), { status: 400, publicMessage: 'This account was disconnected.' });
    const media = post.mediaId ? await Media.findOne({ _id: post.mediaId, owner: post.owner, ready: true }) : null;
    if (post.mediaId && !media) throw Object.assign(new Error(), { status: 400, publicMessage: 'The media is no longer available.' });
    result = await publishStep(post, delivery, connection, media);
  } catch (error) {
    // A timeout after a mutation may mean the platform published it. Never blindly retry.
    const uncertain = ![400, 401, 403].includes(error.status);
    result = { status: uncertain ? 'attention' : 'failed', message: error.publicMessage || 'The platform did not confirm publication. Check its activity before retrying.' };
    if (error.status === 401) await Connection.updateOne({ _id: delivery.connectionId, owner: post.owner }, { status: 'reconnect' });
  }
  const fields = Object.fromEntries(Object.entries(result).map(([k, v]) => [`deliveries.$.${k}`, v]));
  await Post.updateOne({ _id: post._id, deliveries: { $elemMatch: { _id: delivery._id, status: 'sending' } } }, { $set: fields });
}
let ticking = false;
export async function tickQueue() {
  if (ticking || mongoose.connection.readyState !== 1) return;
  ticking = true;
  try {
    // Restarted jobs with an uncertain outcome require review, not duplicate publishing.
    await Post.updateMany({ 'deliveries.status': 'sending' }, { $set: { 'deliveries.$[d].status': 'attention', 'deliveries.$[d].message': 'Connection interrupted. Check the platform before retrying.' } }, { arrayFilters: [{ 'd.status': 'sending', 'd.startedAt': { $lt: new Date(Date.now() - 15 * 60000) } }] });
    const posts = await Post.find({ status: { $in: ['scheduled', 'queued'] }, scheduledAt: { $lte: new Date() } }).sort({ scheduledAt: 1 }).limit(10);
    for (const post of posts) {
      const ready = post.deliveries.filter(d => ['queued', 'processing'].includes(d.status) && +d.nextAt <= Date.now());
      await Promise.allSettled(ready.slice(0, 3).map(d => runDelivery(post, d)));
      const fresh = await Post.findById(post._id);
      const status = summarize(fresh.deliveries);
      await Post.updateOne({ _id: post._id, status: { $in: ['scheduled', 'queued'] } }, { $set: { status } });
    }
  } finally { ticking = false; }
}
export function startQueue() {
  const timer = setInterval(() => tickQueue().catch(() => console.warn('Creator queue will resume on the next check.')), 10000);
  timer.unref(); return () => clearInterval(timer);
}
