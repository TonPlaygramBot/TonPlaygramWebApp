import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonplaygram.app',
  appName: 'TonPlaygram',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'app.tonplaygram.com',
    urlScheme: 'tonplaygram',
    urlHostname: 'app.tonplaygram.com',
    allowNavigation: ['app.tonplaygram.com', 'tonplaygram.com', 'api.tonplaygram.com', 'localhost', '10.0.2.2']
  },
  cordova: {
    preferences: {
      Orientation: 'portrait'
    }
  },
  extra: {
    appBuild: process.env.APP_BUILD || 'dev'
  }
};

export default config;
