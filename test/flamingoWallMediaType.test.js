import { mediaType } from '../bot/utils/mediaType.js';

describe('Protesta Shqiptare media playback types', () => {
  test.each([
    ['application/octet-stream', 'video-from-iphone.MOV', 'video/quicktime'],
    ['', 'protesta.m4v', 'video/mp4'],
    ['video/*', 'protesta.mp4', 'video/mp4'],
    ['application/octet-stream', 'protesta.webm', 'video/webm']
  ])('recovers %s metadata for %s', (storedType, name, expected) => {
    expect(mediaType(storedType, name)).toBe(expected);
  });

  test('keeps a specific MIME type captured by the phone', () => {
    expect(mediaType('video/quicktime', 'clip.mp4')).toBe('video/quicktime');
  });
});
