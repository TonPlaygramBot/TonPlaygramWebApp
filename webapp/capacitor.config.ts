import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonplaygram.app',
  appName: 'TonPlaygram',
  webDir: 'dist',
  cordova: {
    preferences: {
      Orientation: 'portrait'
    }
  },
  server: {
    androidScheme: 'https',
    urlScheme: 'tonplaygram',
    urlHostname: 'tonplaygram'
  }
};

export default config;
