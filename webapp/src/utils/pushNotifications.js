import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushToken } from './api.js';

const STORED_TOKEN_KEY = 'tonplaygram-push-token';

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORED_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORED_TOKEN_KEY, value);
  } catch {
    // ignore storage failures
  }
}

export async function setupNativePushNotifications() {
  if (!Capacitor.isNativePlatform()) return { enabled: false };

  try {
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      const response = await PushNotifications.requestPermissions();
      if (response.receive !== 'granted') {
        return { enabled: false };
      }
    } else if (permission.receive !== 'granted') {
      return { enabled: false };
    }

    await PushNotifications.register();

    const seenToken = getStoredToken();
    const handleRegistration = async ({ value }) => {
      if (!value || value === seenToken) return;
      storeToken(value);
      try {
        await registerPushToken(value, Capacitor.getPlatform());
      } catch (err) {
        console.warn('Failed to register push token', err);
      }
    };

    const registrationListener = await PushNotifications.addListener('registration', handleRegistration);
    const errorListener = await PushNotifications.addListener('registrationError', err => {
      console.error('Push registration failed', err);
    });

    return {
      enabled: true,
      cleanup() {
        registrationListener?.remove();
        errorListener?.remove();
      }
    };
  } catch (err) {
    console.warn('Push notification setup failed', err);
    return { enabled: false, error: err };
  }
}
