// Isolated preview adapter. This module is bundled only by the preview script;
// it never contacts the production API or publishes community content.
const photo = '__WALL_PREVIEW_PHOTO__';
const now = Date.now();
const identity = { author: 'Preview member', authorAvatar: '' };
const posts = [
  {
    _id: 'preview-photo',
    author: 'TonPlayGram',
    createdAt: new Date(now - 12 * 60000).toISOString(),
    text: 'Race night, captured. 🏁\nShare your best moments with the community.',
    attachment: {
      name: 'Kart Royal.webp',
      type: 'image/webp',
      size: 33000,
      url: photo
    }
  },
  {
    _id: 'preview-article',
    author: 'TonPlayGram',
    createdAt: new Date(now - 48 * 60000).toISOString(),
    title: 'A place for every story',
    text: 'Some moments deserve more than a caption. Articles give your ideas space, with a headline, a cover photo, and a body that readers can open right in the feed.\n\nShare a game guide, a match recap, a community update, or a story from your day. Readers can open the full article without leaving the wall.\n\nThis is a sample article in the interactive preview. Use the composer to try a photo, a video from your phone, or an article. Preview posts stay in this tab.'
  }
];
// Reproduce a missing original without contacting or changing the live wall.
const previewOptions = new URLSearchParams(globalThis.location?.search);
if (previewOptions.get('missing') === '1')
  posts.unshift({
    _id: '000000000000000000000007',
    author: identity.author,
    createdAt: new Date(now - 7 * 3600000).toISOString(),
    canManage: true,
    text: 'My video caption stays on this post.',
    attachment: {
      name: 'restore-demo.mp4',
      type: 'video/mp4',
      size: Number(previewOptions.get('bytes')) || 5,
      url: '/missing-preview-video.mp4'
    }
  });
const sessions = new Map();
const listeners = new Set();
const changed = () => listeners.forEach((listener) => listener());
export class EventSource {
  constructor() {
    queueMicrotask(() => this.onopen?.());
  }
  addEventListener(name, listener) {
    if (name === 'wall-change') {
      this.listener = listener;
      listeners.add(listener);
    }
  }
  close() {
    listeners.delete(this.listener);
  }
}
export async function fetch(input, init = {}) {
  if (init.signal?.aborted) throw new DOMException('Paused', 'AbortError');
  const url = new URL(input, 'https://preview.local');
  const route = url.pathname.replace('/api/flamingo-wall', '');
  const reply = (payload, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  if (route === '/identity') return reply(identity);
  if (route.startsWith('/direct-upload/')) {
    const [, , id, number] = route.split('/');
    const session = sessions.get(id);
    if (!session) return reply({ error: 'Preview session expired.' }, 410);
    session.chunks.set((Number(number) - 1) * 5 * 1024 ** 2, init.body);
    return new Response('', {
      status: 200,
      headers: { ETag: `"preview-part-${number}"` }
    });
  }
  if (route === '/posts') return reply({ posts, hasMore: false });
  const mediaStatus = route.match(/^\/posts\/([^/]+)\/media-status$/);
  if (mediaStatus) {
    const post = posts.find((post) => post._id === mediaStatus[1]);
    if (!post) return reply({ code: 'WALL_POST_NOT_FOUND' }, 404);
    const available = post.attachment?.url !== '/missing-preview-video.mp4';
    return reply({
      available,
      code: available ? 'WALL_MEDIA_AVAILABLE' : 'WALL_MEDIA_MISSING',
      canRestore: !available && post.canManage
    });
  }
  const makePost = (fields) => {
    const post = {
      ...fields,
      _id: crypto.randomUUID(),
      author: identity.author,
      createdAt: new Date().toISOString(),
      canManage: true
    };
    posts.unshift(post);
    changed();
    return post;
  };
  if (route === '/posts/content') {
    const fields = JSON.parse(init.body);
    return reply({
      post:
        posts.find((post) => post.clientId === fields.clientId) ||
        makePost(fields)
    });
  }
  if (route === '/uploads') {
    const id = init.headers['X-Upload-Id'];
    const previous = sessions.get(id);
    if (previous)
      return reply({
        transport: 's3-multipart',
        uploadId: id,
        chunkBytes: 5 * 1024 ** 2,
        receivedOffsets: [...previous.chunks.keys()],
        post: previous.post
      });
    const metadata = JSON.parse(init.body);
    sessions.set(id, { ...metadata, chunks: new Map() });
    return reply({
      transport: 's3-multipart',
      uploadId: id,
      chunkBytes: 5 * 1024 ** 2,
      receivedOffsets: []
    });
  }
  if (route.startsWith('/uploads/')) {
    const [, , id, action] = route.split('/');
    const session = sessions.get(id);
    if (!session) return reply({ error: 'Preview upload not found.' }, 404);
    if (action === 'parts') {
      const segments = route.split('/');
      return reply(
        segments[5] === 'sign'
          ? { url: `https://preview.local/direct-upload/${id}/${segments[4]}` }
          : {}
      );
    }
    if (action === 'complete') {
      if (!session.post) {
        const blob = new Blob(
          [...session.chunks.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, chunk]) => chunk),
          { type: session.type }
        );
        const fields = {
          text: session.text,
          title: session.title,
          attachment: {
            name: session.name,
            size: session.size,
            type: session.type,
            duration: session.duration,
            url: URL.createObjectURL(blob)
          }
        };
        if (session.restorePostId) {
          const target = posts.find(
            (post) => post._id === session.restorePostId
          );
          if (!target?.canManage)
            return reply(
              { error: 'Only the author can restore this media.' },
              403
            );
          if (target.attachment.size !== blob.size)
            return reply({ error: 'Choose the original file.' }, 409);
          target.attachment = {
            ...target.attachment,
            url: fields.attachment.url
          };
          session.post = target;
          changed();
        } else session.post = makePost(fields);
      }
      return reply({ post: session.post });
    }
    session.chunks.set(Number(init.headers['X-Upload-Offset']), init.body);
    return reply({
      received: [...session.chunks.values()].reduce(
        (sum, chunk) => sum + chunk.size,
        0
      )
    });
  }
  const match = route.match(/^\/posts\/([^/]+)$/);
  if (match) {
    const index = posts.findIndex((post) => post._id === match[1]);
    if (index < 0) return reply({ error: 'Post not found.' }, 404);
    if (init.method === 'DELETE') {
      posts.splice(index, 1);
      changed();
      return reply({ ok: true });
    }
    if (init.method === 'PATCH') {
      Object.assign(posts[index], JSON.parse(init.body));
      changed();
      return reply({ post: posts[index] });
    }
  }
  return reply({ error: 'This action is unavailable in the preview.' }, 400);
}
