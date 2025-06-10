process.env.MONGODB_URI = 'memory';
process.env.NODE_ENV = 'test';
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app, { mongoReady } from '../server.js';
jest.setTimeout(10000);

describe('Mining API', () => {
  beforeAll(async () => {
    await mongoReady;
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('start and status', async () => {
    await request(app).post('/api/mining/start').send({ telegramId: 123 });
    const res = await request(app).post('/api/mining/status').send({ telegramId: 123 });
    expect(res.body).toHaveProperty('pending');
  });
});
