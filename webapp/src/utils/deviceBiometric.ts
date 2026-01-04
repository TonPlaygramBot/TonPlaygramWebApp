import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const NATIVE_BIOMETRIC_ID = 'native-biometric';

const STORAGE_KEY = 'tpc-native-credential-id';

export async function checkNativeBiometricAvailable() {
  if (!Capacitor.isNativePlatform()) return { available: false };
  try {
    const info = await BiometricAuth.checkBiometry();
    return {
      available: Boolean(info?.isAvailable || info?.strongBiometryIsAvailable || info?.deviceIsSecure),
      code: info?.code || '',
      reason: info?.reason || ''
    };
  } catch (err) {
    console.warn('Native biometric availability failed', err);
    return { available: false, error: err?.code || err?.message || 'unknown' };
  }
}

export async function authenticateNativeBiometric(reason = 'Unlock your TonPlaygram profile') {
  if (!Capacitor.isNativePlatform()) return { ok: false, error: 'not_native' };
  try {
    await BiometricAuth.authenticate({
      reason,
      allowDeviceCredential: true
    });
    return { ok: true };
  } catch (err) {
    const code = err?.code || err?.message || '';
    if (code === 'biometryNotEnrolled' || code === 'passcodeNotSet') {
      return { ok: false, error: 'not_configured' };
    }
    return { ok: false, error: 'device_failed' };
  }
}

export async function saveNativeCredentialId(id: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: STORAGE_KEY, value: id });
  } catch (err) {
    console.warn('Failed to save native credential id', err);
  }
}

export async function loadNativeCredentialId() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return value || null;
  } catch (err) {
    console.warn('Failed to load native credential id', err);
    return null;
  }
}

export async function clearNativeCredentialId() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: STORAGE_KEY });
  } catch (err) {
    console.warn('Failed to clear native credential id', err);
  }
}
