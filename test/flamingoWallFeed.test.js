import { reconcileWallPosts } from '../webapp/src/features/flamingo/wallFeed.js';

describe('Protesta Shqiptare wall feed refresh', () => {
  test('keeps a successful new upload when an older feed response arrives', () => {
    const pending = new Set(['new-video']);
    const current = [{ id: 'new-video' }, { id: 'older-video' }];
    const remote = [{ id: 'older-video' }];

    expect(reconcileWallPosts(remote, current, pending)).toEqual(current);
    expect(pending.has('new-video')).toBe(true);
  });

  test('stops protecting an upload once the live server feed contains it', () => {
    const pending = new Set(['new-video']);
    const remote = [{ id: 'new-video', text: 'server copy' }, { id: 'older-video' }];

    expect(reconcileWallPosts(remote, [{ id: 'new-video', text: 'local copy' }], pending)).toEqual(remote);
    expect(pending.size).toBe(0);
  });
});
