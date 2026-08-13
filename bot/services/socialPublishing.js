import SocialPost from '../models/SocialPost.js';
import { getSocialProvider } from './socialProviders.js';
import { runSocialAutomations } from './socialAutomation.js';

export async function publishOne(postId, publicationId) {
  const post = await SocialPost.findById(postId);
  const publication = post?.publications.id(publicationId);
  if (!post || !publication || publication.status === 'PUBLISHED' || publication.status === 'CANCELLED') return;
  publication.status = 'PUBLISHING'; publication.attempts += 1; await post.save();
  try {
    const result = await getSocialProvider(publication.platform).publish(post.toObject());
    publication.status = 'PUBLISHED'; publication.externalId = result.externalId; publication.publicationUrl = result.publicationUrl; publication.publishedAt = new Date(); publication.errorMessage = undefined; publication.errorType = undefined;
    await post.save(); await runSocialAutomations('PROVIDER_SUCCEEDED', post, publication);
  } catch (error) {
    publication.status = 'FAILED'; publication.errorType = error.type || 'RETRYABLE_ERROR'; publication.errorMessage = String(error.message || 'Provider failed').replace(/token=[^\s&]+/gi, 'token=[redacted]').slice(0, 500);
    await post.save(); await runSocialAutomations('PROVIDER_FAILED', post, publication);
  }
  const statuses = post.publications.map((item) => item.status);
  if (statuses.every((status) => status === 'PUBLISHED')) { post.status = 'PUBLISHED'; await post.save(); await runSocialAutomations('ALL_PUBLISHED', post); }
  else if (statuses.every((status) => ['PUBLISHED', 'FAILED'].includes(status)) && statuses.includes('FAILED')) { post.status = 'PARTIALLY_FAILED'; await post.save(); await runSocialAutomations('PARTIALLY_FAILED', post); }
}

export function queuePublication(postId, publicationId, delay = 0) {
  const timer = setTimeout(() => publishOne(postId, publicationId).catch((error) => console.error('Social publication job failed:', error.message)), delay);
  timer.unref?.();
}

export async function queueDueSocialPosts() {
  const posts = await SocialPost.find({ status: 'SCHEDULED', scheduledAt: { $lte: new Date() } });
  for (const post of posts) {
    post.status = 'QUEUED'; post.publications.forEach((publication) => { if (publication.status === 'SCHEDULED') publication.status = 'QUEUED'; }); await post.save();
    post.publications.forEach((publication) => queuePublication(post._id, publication._id));
  }
}
