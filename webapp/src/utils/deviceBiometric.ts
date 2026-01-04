import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export const NATIVE_CREDENTIAL_ID = 'native-biometric';
const NATIVE_CREDENTIAL_KEY = 'tpc-profile-lock-credential';

export async function isNativeBiometricAvailable() {
  if (!Capacitor.isNativePlatform()) return { available: false, secure: false };
  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: Boolean(result?.isAvailable || result?.deviceIsSecure),
      secure: Boolean(result?.strongBiometryIsAvailable || result?.deviceIsSecure)
    };
  } catch (err) {
    console.warn('Biometric availability check failed', err);
    return { available: false, secure: false };
  }
}

export async function authenticateNativeBiometric(reason?: string) {
  if (!Capacitor.isNativePlatform()) return { ok: false, error: 'device_unsupported' };
  try {
    await BiometricAuth.authenticate({
      reason: reason || 'Authenticate to continue',
      allowDeviceCredential: true
    });
    return { ok: true };
  } catch (err) {
    const code = err?.code;
    if (code === BiometryErrorType.biometryNotEnrolled || code === BiometryErrorType.noDeviceCredential) {
      return { ok: false, error: 'device_not_configured' };
    }
    return { ok: false, error: err?.message || 'device_failed' };
  }
}

export async function storeNativeCredentialId(id: string) {
  if (!id || !Capacitor.isNativePlatform()) return;
  try {
    await SecureStorage.setItem(NATIVE_CREDENTIAL_KEY, id);
  } catch (err) {
    console.warn('Failed to store native credential id', err);
  }
}

export async function loadNativeCredentialId(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await SecureStorage.getItem(NATIVE_CREDENTIAL_KEY);
    return res || null;
  } catch {
    return null;
  }
}

export async function clearNativeCredentialId() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SecureStorage.removeItem(NATIVE_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}
