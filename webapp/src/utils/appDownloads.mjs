// Only link to explicitly configured public HTTPS downloads.
export function publicDownloadUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function getAppDownloadLinks(env = {}) {
  return {
    android: publicDownloadUrl(env.VITE_ANDROID_APK_URL) || publicDownloadUrl(env.VITE_LAUNCHER_URL),
    ios: publicDownloadUrl(env.VITE_IOS_APP_URL)
  };
}
