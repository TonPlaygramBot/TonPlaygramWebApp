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
});

describe('Protesta Shqiptare media reconnect retries', () => {
  test('cache-busts a failed historical video request without losing its revision', () => {
    expect(retryWallMediaUrl('https://api.example/files/old.mp4?v=123', 2))
      .toBe('https://api.example/files/old.mp4?v=123&retry=2');
  });

  test('does not rewrite local preview blobs', () => {
    expect(retryWallMediaUrl('blob:https://app.example/id', 2))
      .toBe('blob:https://app.example/id');
  });
});
