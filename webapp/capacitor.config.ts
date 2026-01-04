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
    androidScheme: 'https'
  },
  plugins: {
    App: {
      urlScheme: 'tonplaygram',
      deeplinks: ['tonplaygram']
    }
  }
};

export default config;
