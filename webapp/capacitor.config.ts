import type { CapacitorConfig } from '@capacitor/cli';

const APP_BUILD =
  process.env.APP_BUILD ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'dev';
const OFFLINE_BUNDLE = process.env.CAPACITOR_OFFLINE === 'true';

const config: CapacitorConfig = {
  appId: 'com.tonplaygram.app',
  appName: 'TonPlaygram',
  webDir: 'dist',
  bundledWebRuntime: false,
  cordova: {
    preferences: {
      Orientation: 'portrait'
    }
  },
  server: {
    androidScheme: 'https',
    urlScheme: 'tonplaygram',
    urlHostname: 'tonplaygram'
  },
  extra: {
    appBuild: APP_BUILD,
    offlineBundle: OFFLINE_BUNDLE
  }
};

export default config;
