import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const DEVICE_CREDENTIAL_KEY = 'tpc-device-credential-id';

function isNative() {
  return Boolean(Capacitor?.isNativePlatform?.());
}

export async function checkBiometricAvailability() {
  if (!isNative()) return { available: false };
  try {
    const result = await BiometricAuth.checkBiometry();
    if (!result.isAvailable && result.code === BiometryErrorType.biometryNotEnrolled) {
      return { available: false, reason: 'not_enrolled' as const };
    }
    return { available: result.isAvailable, type: result.biometryType, reason: result.reason };
  } catch (err: any) {
    return { available: false, error: err?.code || 'unknown' };
  }
}

export async function authenticateDevice(reason?: string) {
  if (!isNative()) return { ok: false, error: 'device_unsupported' as const };
  try {
    await BiometricAuth.authenticate({
      reason: reason || 'Authenticate to continue',
      allowDeviceCredential: true
    });
    return { ok: true as const };
  } catch (err: any) {
    const code = err?.code || err?.message;
    const normalized =
      code === BiometryErrorType.biometryNotEnrolled || code === 'passcodeNotSet'
        ? 'not_enrolled'
        : 'device_failed';
    return { ok: false as const, error: normalized };
  }
}

export async function saveDeviceCredentialId(id: string) {
  if (!id || !isNative()) return;
  try {
    await SecureStorage.set(DEVICE_CREDENTIAL_KEY, id);
  } catch {
    // ignore secure storage failures
  }
}

export async function loadDeviceCredentialId() {
  if (!isNative()) return null;
  try {
    const value = await SecureStorage.get(DEVICE_CREDENTIAL_KEY);
    return (value as unknown as string) || null;
  } catch {
    return null;
  }
}

export async function clearDeviceCredentialId() {
  if (!isNative()) return;
  try {
    await SecureStorage.remove(DEVICE_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}
