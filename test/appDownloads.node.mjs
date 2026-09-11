import test from 'node:test';
import assert from 'node:assert/strict';
import { getAppDownloadLinks, publicDownloadUrl } from '../webapp/src/utils/appDownloads.mjs';

test('unpublished builds never produce invented download links', () => {
  assert.deepEqual(getAppDownloadLinks(), { android: '', ios: '' });
});

test('release APK takes precedence, with backwards-compatible launcher fallback', () => {
  const old = 'https://downloads.example.org/launcher.apk';
  const apk = 'https://downloads.example.org/app.apk';
  assert.equal(getAppDownloadLinks({ VITE_LAUNCHER_URL: old }).android, old);
  assert.equal(getAppDownloadLinks({ VITE_LAUNCHER_URL: old, VITE_ANDROID_APK_URL: apk }).android, apk);
  assert.equal(getAppDownloadLinks({ VITE_IOS_APP_URL: 'https://apps.apple.com/app/id123' }).ios, 'https://apps.apple.com/app/id123');
});

test('reject unsafe, malformed and credential-bearing download destinations', () => {
  for (const value of [undefined, '', '/app.apk', 'javascript:alert(1)', 'http://example.org/app.apk', 'https://user:pass@example.org/app.apk']) {
    assert.equal(publicDownloadUrl(value), '');
  }
});
