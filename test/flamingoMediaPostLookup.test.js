import { wallMediaPostQuery } from '../bot/utils/flamingoPostLookup.js';

describe('Protesta Shqiptare historical video lookup', () => {
  const matches = (query, url) => query.$or.some(condition => {
    const expected = condition['attachment.url'];
    return expected?.$regex ? expected.$regex.test(url) : expected === url;
  });

  test('finds current relative attachment URLs', () => {
    const query = wallMediaPostQuery('video.mp4');
    expect(matches(query, '/api/flamingo-wall/files/video.mp4')).toBe(true);
  });

  test('finds absolute legacy URLs including encoded names and old query strings', () => {
    const query = wallMediaPostQuery('morning protest.mp4');
    expect(matches(query, 'https://old-api.example/api/flamingo-wall/files/morning%20protest.mp4?token=old')).toBe(true);
  });

  test('does not confuse similarly named media', () => {
    const query = wallMediaPostQuery('protest.mp4');
    expect(matches(query, 'https://old-api.example/api/flamingo-wall/files/other-protest.mp4')).toBe(false);
  });
});
