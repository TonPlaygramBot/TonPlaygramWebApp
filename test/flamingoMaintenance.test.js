import { jest } from '@jest/globals';
import { ANTAR_KOMITETI_AUTHOR, removeAntarKomitetiPosts } from '../bot/utils/flamingoMaintenance.js';

describe('wall moderation cleanup', () => {
  test('matches harmless capitalization, spacing, and punctuation differences', () => {
    expect(ANTAR_KOMITETI_AUTHOR.test('Antar komiteti')).toBe(true);
    expect(ANTAR_KOMITETI_AUTHOR.test('  ANTAR   KOMITETI. ')).toBe(true);
    expect(ANTAR_KOMITETI_AUTHOR.test('another user')).toBe(false);
  });

  test('deletes at most the two newest matching posts on the active connection', async () => {
    const lean = jest.fn().mockResolvedValue([{ _id: 'newest' }, { _id: 'older' }]);
    const select = jest.fn(() => ({ lean }));
    const limit = jest.fn(() => ({ select }));
    const sort = jest.fn(() => ({ limit }));
    const find = jest.fn(() => ({ sort }));
    const deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
    const model = { find, deleteMany };

    await expect(removeAntarKomitetiPosts(model)).resolves.toBe(2);
    expect(find).toHaveBeenCalledWith({ author: ANTAR_KOMITETI_AUTHOR });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(2);
    expect(deleteMany).toHaveBeenCalledWith({ _id: { $in: ['newest', 'older'] } });
  });
});
