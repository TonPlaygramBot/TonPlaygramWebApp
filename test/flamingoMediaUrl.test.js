import { resolveWallMediaUrl, retryWallMediaUrl } from '../webapp/src/features/flamingo/mediaUrl.js';

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

  test('bypasses a stale cached failure using the attachment revision', () => {
    expect(resolveWallMediaUrl(api, '/api/flamingo-wall/files/protesta.mp4', 21900))
      .toBe(`${api}/api/flamingo-wall/files/protesta.mp4?v=21900`);
    expect(resolveWallMediaUrl(api, '/api/flamingo-wall/files/protesta.mp4?token=old', 21900))
      .toBe(`${api}/api/flamingo-wall/files/protesta.mp4?token=old&v=21900`);
  });

  test('does not rewrite external or local preview media', () => {
    expect(resolveWallMediaUrl(api, 'https://cdn.example/video.mp4')).toBe('https://cdn.example/video.mp4');
    expect(resolveWallMediaUrl(api, 'blob:phone-preview')).toBe('blob:phone-preview');
  });

  test('gives failed phone media requests a fresh retry URL', () => {
    expect(retryWallMediaUrl(`${api}/api/flamingo-wall/files/protesta.mp4?v=21900`, 2))
      .toBe(`${api}/api/flamingo-wall/files/protesta.mp4?v=21900&retry=2`);
    expect(retryWallMediaUrl('/api/flamingo-wall/files/protesta.mp4', 1))
      .toBe('/api/flamingo-wall/files/protesta.mp4?retry=1');
    expect(retryWallMediaUrl('blob:phone-preview', 1)).toBe('blob:phone-preview');
  });
});
