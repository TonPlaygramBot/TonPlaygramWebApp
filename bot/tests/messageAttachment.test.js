import test from 'node:test';
import assert from 'node:assert/strict';
import Message from '../models/Message.js';

test('message attachments retain their upload metadata as an object', () => {
  const attachment = {
    name: 'portrait-photo.jpg',
    size: 2048,
    type: 'image/jpeg',
    url: '/api/social/message-files/upload-photo.jpg'
  };
  const message = new Message({ from: 'sender', to: 'recipient', text: 'Shared a photo', attachment });

  assert.equal(message.validateSync(), undefined);
  assert.deepEqual(message.toObject().attachment, attachment);
  assert.equal(Message.schema.path('attachment').instance, 'Mixed');
});
