import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tonplaygram.app',
  appName: 'TonPlaygram',
  // Bundle the complete Vite output, not a remote homepage/launcher URL.
  webDir: 'dist',
  cordova: { preferences: { Orientation: 'portrait' } },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0B1224',
      androidScaleType: 'CENTER_INSIDE',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      launchShowDuration: 0
    }
  },
  server: {
    androidScheme: 'https',
    // Keep bundled resources separate from the real HTTPS API origin.
    // Native API/socket URLs must be supplied by the release build environment.
    hostname: 'localhost',
    allowNavigation: []
  }
};

export default config;
