import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import FlamingoPost from '../bot/models/FlamingoPost.js';

test('allows multiple community wall posts without a source id', { timeout: 20000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const connection = await mongoose
    .createConnection(mongo.getUri(), { serverSelectionTimeoutMS: 20000 })
    .asPromise();

  try {
    const Post = connection.model('FlamingoPost', FlamingoPost.schema);
    await Post.init();
    await Post.create({ author: 'First citizen', text: 'First video' });
    await Post.create({ author: 'Second citizen', text: 'Second video' });

    const posts = await Post.find().lean();
    assert.equal(posts.length, 2);
    assert.ok(posts.every(post => !Object.hasOwn(post, 'sourceId')));
  } finally {
    await connection.close();
    await mongo.stop();
  }
});

test('still rejects duplicate imported source ids', { timeout: 20000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  const connection = await mongoose
    .createConnection(mongo.getUri(), { serverSelectionTimeoutMS: 20000 })
    .asPromise();

  try {
    const Post = connection.model('FlamingoPost', FlamingoPost.schema);
    await Post.init();
    await Post.create({ author: 'Channel', source: 'telegram', sourceId: '42' });
    await assert.rejects(
      Post.create({ author: 'Channel', source: 'telegram', sourceId: '42' }),
      error => error?.code === 11000
    );
  } finally {
    await connection.close();
    await mongo.stop();
  }
});

test('stores the exact GridFS id with a wall attachment', () => {
  const databaseFileId = new mongoose.Types.ObjectId();
  const post = new FlamingoPost({
    author: 'Community member',
    attachment: {
      name: 'phone-video.mp4',
      type: 'video/mp4',
      url: '/api/flamingo-wall/files/stable-phone-video.mp4',
      databaseFileId
    }
  });

  assert.equal(String(post.attachment.databaseFileId), String(databaseFileId));
});
