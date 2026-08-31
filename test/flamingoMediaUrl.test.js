import { resolveWallMediaUrl } from '../webapp/src/features/flamingo/mediaUrl.js';

describe('Protesta Shqiptare historical media URLs', () => {
  const api = 'https://tonplaygram-bot.onrender.com';

  test('opens relative media paths on the active API', () => {
    expect(resolveWallMediaUrl(api, '/api/flamingo-wall/files/protesta.mp4'))
      .toBe(`${api}/api/flamingo-wall/files/protesta.mp4`);
  });

  test('moves absolute URLs from an earlier API host to the active API', () => {
    expect(resolveWallMediaUrl(api, 'https://old-api.example/api/flamingo-wall/files/morning%20protest.mov?token=old'))
      .toBe(`${api}/api/flamingo-wall/files/morning%20protest.mov?token=old`);
  });

  test('does not rewrite external or local preview media', () => {
    expect(resolveWallMediaUrl(api, 'https://cdn.example/video.mp4')).toBe('https://cdn.example/video.mp4');
    expect(resolveWallMediaUrl(api, 'blob:phone-preview')).toBe('blob:phone-preview');
  });
});
