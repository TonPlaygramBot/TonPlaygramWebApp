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
    // Production host used by the Android shell.
    hostname: 'tonplaygram-bot.onrender.com',
    allowNavigation: [
      'tonplaygram-bot.onrender.com',
      // Keep existing production domains for future migrations.
      'tonplaygram.com',
      'api.tonplaygram.com'
    ],
    urlScheme: 'tonplaygram',
    urlHostname: 'tonplaygram'
  }
};

export default config;
