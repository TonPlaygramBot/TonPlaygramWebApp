import { EventEmitter } from 'events';
import { waitForMongoReady } from '../bot/utils/mongoReadiness.js';

describe('Protesta Shqiptare MongoDB media readiness', () => {
  test('returns immediately for an established database connection', async () => {
    const connection = Object.assign(new EventEmitter(), { readyState: 1, db: {} });

    await expect(waitForMongoReady(connection, 100)).resolves.toBe(true);
  });

  test('lets an in-flight reconnect finish before loading wall videos', async () => {
    const connection = Object.assign(new EventEmitter(), { readyState: 2, db: undefined });
    const readiness = waitForMongoReady(connection, 100);

    connection.readyState = 1;
    connection.db = {};
    connection.emit('connected');

    await expect(readiness).resolves.toBe(true);
    expect(connection.listenerCount('connected')).toBe(0);
    expect(connection.listenerCount('open')).toBe(0);
    expect(connection.listenerCount('error')).toBe(0);
  });

  test('shares one readiness listener set across parallel video range requests', async () => {
    const connection = Object.assign(new EventEmitter(), { readyState: 2, db: undefined });
    const requests = Array.from({ length: 20 }, () => waitForMongoReady(connection, 100));

    expect(connection.listenerCount('connected')).toBe(1);
    connection.readyState = 1;
    connection.db = {};
    connection.emit('connected');

    await expect(Promise.all(requests)).resolves.toEqual(Array(20).fill(true));
  });

  test('keeps waiting when Atlas reports a transient error during host selection', async () => {
    const connection = Object.assign(new EventEmitter(), { readyState: 2, db: undefined });
    const readiness = waitForMongoReady(connection, 100);

    connection.emit('error', new Error('temporary server selection failure'));
    connection.readyState = 1;
    connection.db = {};
    connection.emit('connected');

    await expect(readiness).resolves.toBe(true);
    expect(connection.listenerCount('error')).toBe(0);
  });

  test('fails quickly and removes listeners when MongoDB stays unavailable', async () => {
    const connection = Object.assign(new EventEmitter(), { readyState: 0, db: undefined });

    await expect(waitForMongoReady(connection, 5)).resolves.toBe(false);
    expect(connection.listenerCount('connected')).toBe(0);
    expect(connection.listenerCount('open')).toBe(0);
    expect(connection.listenerCount('error')).toBe(0);
  });
});
