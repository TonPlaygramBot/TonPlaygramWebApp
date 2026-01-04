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
  plugins: {
    SplashScreen: {
      backgroundColor: '#0B1224',
      androidScaleType: 'CENTER_INSIDE',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      launchShowDuration: 0
    }
  },
  extra: {
    appBuild: process.env.APP_BUILD || 'dev'
  },
  server: {
    androidScheme: 'https',
    hostname: 'tonplaygram.com',
    allowNavigation: ['tonplaygram.com', 'api.tonplaygram.com'],
    urlScheme: 'tonplaygram',
    urlHostname: 'tonplaygram'
  }
};

export default config;
