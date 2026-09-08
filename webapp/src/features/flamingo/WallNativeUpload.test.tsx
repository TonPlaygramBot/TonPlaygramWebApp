import { afterEach, expect, it, vi } from 'vitest';
import { uploadNativeWallFile } from './wallNativeUpload.js';

function request() {
  const xhr: any = {
    upload: {},
    status: 200,
    responseText: JSON.stringify({ received: 10, complete: true }),
    open: vi.fn(),
    send: vi.fn(),
    setRequestHeader: vi.fn()
  };
  xhr.abort = vi.fn(() => xhr.onabort?.());
  return xhr;
}
const file = () => new File(['1234567890'], 'phone.mp4', { type: 'video/mp4' });
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('sends the original picker File without calling any JavaScript file reader', async () => {
  const original = file();
  const slice = vi.spyOn(original, 'slice').mockImplementation(() => {
    throw new DOMException('Unreadable', 'NotReadableError');
  });
  const reader = vi.spyOn(window, 'FileReader');
  const xhr = request();
  const progress = vi.fn();
  const pending = uploadNativeWallFile({
    url: '/uploads/id/file',
    headers: {
      'X-Wall-Owner-Token': 'owner',
      'Content-Type': 'application/json'
    },
    file: original,
    createRequest: () => xhr,
    onProgress: progress
  });
  expect(xhr.open).toHaveBeenCalledWith('POST', '/uploads/id/file', true);
  expect(xhr.send.mock.calls[0][0]).toBeInstanceOf(FormData);
  expect(xhr.send.mock.calls[0][0].get('file')).toBe(original);
  expect(slice).not.toHaveBeenCalled();
  expect(reader).not.toHaveBeenCalled();
  expect(xhr.setRequestHeader.mock.calls).toEqual([
    ['X-Wall-Owner-Token', 'owner']
  ]);
  xhr.upload.onprogress({ loaded: 75, total: 150, lengthComputable: true });
  expect(progress).toHaveBeenLastCalledWith(5);
  xhr.onload();
  expect(await pending).toEqual({ received: 10, complete: true });
  expect(xhr.upload.onprogress).toBeNull();
});

it('aborts the native upload when paused and clears its idle timer', async () => {
  vi.useFakeTimers();
  const xhr = request();
  const controller = new AbortController();
  const pending = uploadNativeWallFile({
    url: '/file',
    file: file(),
    signal: controller.signal,
    createRequest: () => xhr
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(xhr.abort).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('allows a long upload while bytes are still moving, and times out a stalled one', async () => {
  vi.useFakeTimers();
  const xhr = request();
  const pending = uploadNativeWallFile({
    url: '/file',
    file: file(),
    createRequest: () => xhr,
    idleTimeoutMs: 1000
  });
  for (let i = 1; i <= 6; i++) {
    vi.advanceTimersByTime(900);
    xhr.upload.onprogress({ loaded: i, total: 10, lengthComputable: true });
  }
  expect(xhr.abort).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  await expect(pending).rejects.toMatchObject({
    code: 'WALL_NATIVE_INTERRUPTED'
  });
  expect(xhr.abort).toHaveBeenCalledTimes(1);
});

it('preserves a real storage rejection instead of labeling it a phone read error', async () => {
  const xhr = request();
  xhr.status = 507;
  xhr.responseText = JSON.stringify({
    code: 'WALL_DISK_FULL',
    error: 'Storage is full.'
  });
  const pending = uploadNativeWallFile({
    url: '/file',
    file: file(),
    createRequest: () => xhr
  });
  xhr.onload();
  await expect(pending).rejects.toMatchObject({
    status: 507,
    code: 'WALL_DISK_FULL',
    message: 'Storage is full.'
  });
});

it('never reports success without a valid server response', async () => {
  const xhr = request();
  xhr.responseText = '<html>Proxy error</html>';
  const pending = uploadNativeWallFile({
    url: '/file',
    file: file(),
    createRequest: () => xhr
  });
  xhr.onload();
  await expect(pending).rejects.toThrow('not confirmed');
});
