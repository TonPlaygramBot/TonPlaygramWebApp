import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getPlayerId } from '../utils/telegram.js';
import { registerPushToken } from '../utils/api.js';

export default function useNativePushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const registerDevice = async () => {
      const permissions = await PushNotifications.checkPermissions();
      if (permissions.receive !== 'granted') {
        const requested = await PushNotifications.requestPermissions();
        if (requested.receive !== 'granted') return;
      }
      await PushNotifications.register();
    };

    const registrationListener = PushNotifications.addListener('registration', async ({ value }) => {
      const accountId = getPlayerId();
      await registerPushToken({
        token: value,
        platform: Capacitor.getPlatform(),
        accountId
      });
    });

    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration failed', err);
    });

    const dispatchPush = (notification) => {
      if (notification?.data?.type === 'gameInvite') {
        window.dispatchEvent(new CustomEvent('game-invite-push', { detail: notification.data }));
      }
      if (notification?.data?.type === 'friendCall') {
        window.dispatchEvent(new CustomEvent('friend-call:incoming-push', { detail: notification.data }));
      }
      if (notification?.data?.type === 'friendRequest') {
        window.dispatchEvent(new CustomEvent('friend-request:push', { detail: notification.data }));
      }
    };

    const receivedListener = PushNotifications.addListener('pushNotificationReceived', dispatchPush);

    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      dispatchPush(notification);
    });

    registerDevice().catch((err) => console.warn('Unable to register for push', err));

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
      receivedListener?.remove();
      actionListener?.remove();
    };
  }, []);
}
