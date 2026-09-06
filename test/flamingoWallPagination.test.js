import { decodeFlamingoWallCursor, encodeFlamingoWallCursor, flamingoWallCursorQuery, flamingoWallPageSize } from '../bot/utils/flamingoWallPagination.js';

describe('TonPlayGram social wall MongoDB history', () => {
  test('round trips a stable date and Mongo id cursor', () => {
    const encoded = encodeFlamingoWallCursor({ _id: '507f1f77bcf86cd799439011', createdAt: '2024-01-02T03:04:05.000Z' });
    expect(decodeFlamingoWallCursor(encoded)).toEqual({ id: '507f1f77bcf86cd799439011', createdAt: new Date('2024-01-02T03:04:05.000Z') });
  });
  test('continues before timestamp and id without skipping posts', () => {
    const cursor = { id: '507f1f77bcf86cd799439011', createdAt: new Date('2024-01-02T03:04:05.000Z') };
    expect(flamingoWallCursorQuery(cursor, id => `object:${id}`)).toEqual({ $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: `object:${cursor.id}` } }] });
  });
  test('uses phone-sized pages with a safe server cap', () => {
    expect(flamingoWallPageSize()).toBe(20);
    expect(flamingoWallPageSize(500)).toBe(50);
  });
});
