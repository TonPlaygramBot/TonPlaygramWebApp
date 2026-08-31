import test from 'node:test';
import assert from 'node:assert/strict';
import { latestWallPost, serializeWallPosts } from '../bot/routes/flamingoWall.js';

test('keeps every published wall video in the database-backed feed', () => {
  const posts = [
    {
      _id: 'morning-video',
      author: 'Anëtar i komitetit',
      text: 'Protesta shqiptare',
      attachment: { name: 'protesta.mov', type: 'application/octet-stream' }
    },
    { _id: 'earlier-post', author: 'Qytetar', text: 'Postim i mëparshëm' }
  ];

  const response = serializeWallPosts(posts);

  assert.deepEqual(response.map(post => post._id), ['morning-video', 'earlier-post']);
  assert.equal(response[0].attachment.type, 'video/quicktime');
});

test('shows the newest database post on the home page without author filtering', () => {
  const newest = {
    _id: 'morning-video',
    author: 'Antar i komitetit',
    attachment: { name: 'protesta.mp4', type: 'video/mp4' }
  };

  assert.equal(latestWallPost(newest)._id, 'morning-video');
  assert.equal(latestWallPost(null), null);
});
