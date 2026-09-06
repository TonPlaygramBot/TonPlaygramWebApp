import { mongoConnectionOptions } from '../bot/config/mongo.js';

describe('compact MongoDB connection settings', () => {
  test('uses a bounded, idle-friendly compressed pool by default', () => {
    expect(mongoConnectionOptions({})).toEqual({
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000,
      compressors: ['zlib'],
      zlibCompressionLevel: 6
    });
  });

  test('accepts safe operator overrides and rejects invalid ones', () => {
    expect(mongoConnectionOptions({
      MONGO_MAX_POOL_SIZE: '24',
      MONGO_MIN_POOL_SIZE: '-2',
      MONGO_MAX_IDLE_TIME_MS: '15000',
      MONGO_SERVER_SELECTION_TIMEOUT_MS: 'invalid',
      MONGO_ZLIB_COMPRESSION_LEVEL: '9'
    })).toMatchObject({
      maxPoolSize: 24,
      minPoolSize: 0,
      maxIdleTimeMS: 15_000,
      serverSelectionTimeoutMS: 10_000,
      zlibCompressionLevel: 9
    });
  });
});
