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
    // This is the origin of Capacitor's on-device asset server. There is no
    // remote `server.url`: cap sync packages webDir into the APK so the UI,
    // games and static assets load locally after installation.
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
