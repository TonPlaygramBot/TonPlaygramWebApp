import { ownsPost, serializeWallPosts } from '../bot/routes/flamingoWall.js';

describe('Protesta Shqiptare post ownership', () => {
  test('restores management after a signed-in author loses the old browser token', () => {
    const post = {
      _id: 'legacy-post',
      author: 'Anëtar i komunitetit',
      authorAccountId: 'member-47',
      ownerTokenHash: 'an-old-browser-token-hash'
    };

    expect(ownsPost(post, 'different-browser-token', 'member-47')).toBe(true);
    expect(serializeWallPosts([post], 'different-browser-token', 'member-47')[0]).toMatchObject({
      canManage: true,
      authorAccountId: 'member-47'
    });
  });

  test('does not give another signed-in member access to the post', () => {
    expect(ownsPost({
      authorAccountId: 'member-47',
      ownerTokenHash: 'an-old-browser-token-hash'
    }, 'different-browser-token', 'member-99')).toBe(false);
  });
});
