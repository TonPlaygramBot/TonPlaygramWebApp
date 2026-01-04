import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearLockConfig,
  getDeviceCredentialId,
  isUnlocked,
  loadLockConfig,
  markUnlockedSession,
  setSecretLock,
  storeDeviceCredentialId,
  verifyRecoveryCode,
  verifySecret
} from '../utils/profileLock.js';
import {
  authenticateNativeBiometric,
  clearNativeCredentialId,
  isNativeBiometricAvailable,
  loadNativeCredentialId,
  NATIVE_CREDENTIAL_ID,
  storeNativeCredentialId
} from '../utils/deviceBiometric';

function bufferFromBase64url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function base64urlFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TELEGRAM_BIOMETRIC_ID = 'telegram-biometric';

async function isTelegramBiometricAvailable() {
  if (typeof window === 'undefined') return false;
  const manager = window?.Telegram?.WebApp?.BiometricManager;
  if (!manager?.isBiometricAvailable) return false;
  try {
    const result = await manager.isBiometricAvailable();
    if (result === true) return true;
    if (typeof result === 'object') {
      return Boolean(result.available ?? result.isAvailable ?? result.ok ?? result.success);
    }
    return false;
  } catch (err) {
    console.warn('Telegram biometric availability check failed', err);
    return false;
  }
}

async function authenticateWithTelegramBiometric() {
  if (typeof window === 'undefined') return { ok: false };
  const manager = window?.Telegram?.WebApp?.BiometricManager;
  if (!manager?.authenticate) return { ok: false };
  try {
    const result = await manager.authenticate({
      reason: 'Unlock your TonPlaygram profile with biometrics'
    });
    const success =
      result === true ||
      result === 'OK' ||
      result?.authenticated ||
      result?.ok ||
      result?.success;
    return { ok: success, error: success ? undefined : 'device_failed' };
  } catch (err) {
    console.error('Telegram biometric unlock failed', err);
    return { ok: false, error: err?.message || 'device_failed' };
  }
}

export default function useProfileLock() {
  const [config, setConfig] = useState(() => loadLockConfig());
  const [status, setStatus] = useState(() => (isUnlocked() || !config ? 'unlocked' : 'locked'));
  const [issuedRecoveryCodes, setIssuedRecoveryCodes] = useState([]);
  const [lastError, setLastError] = useState('');
  const [deviceSupported, setDeviceSupported] = useState(
    typeof window !== 'undefined' &&
      (!!window.PublicKeyCredential ||
        loadLockConfig()?.credentialId === TELEGRAM_BIOMETRIC_ID ||
        loadLockConfig()?.credentialId === NATIVE_CREDENTIAL_ID)
  );
  const [telegramBiometricSupported, setTelegramBiometricSupported] = useState(false);
  const [nativeBiometricSupported, setNativeBiometricSupported] = useState(false);
  const [nativeCredentialId, setNativeCredentialId] = useState(null);
  const locked = status === 'locked';

  useEffect(() => {
    let cancelled = false;
    const currentConfig = loadLockConfig();
    setConfig(currentConfig);
    setStatus(isUnlocked() || !currentConfig ? 'unlocked' : 'locked');
    if (typeof window !== 'undefined') {
      const hasStoredTelegramDevice =
        currentConfig?.credentialId === TELEGRAM_BIOMETRIC_ID ||
        currentConfig?.credentialId === NATIVE_CREDENTIAL_ID;
      const hasWebAuthn = !!window.PublicKeyCredential;
      setDeviceSupported(hasWebAuthn || hasStoredTelegramDevice);
    }
    if (typeof window !== 'undefined' && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          if (!cancelled) setDeviceSupported((prev) => prev || Boolean(available));
        })
        .catch(() => {
          if (!cancelled) setDeviceSupported((prev) => prev || !!window.PublicKeyCredential);
        });
    }
    (async () => {
      const telegramAvailable = await isTelegramBiometricAvailable();
      if (cancelled) return;
      setTelegramBiometricSupported(telegramAvailable);
      if (telegramAvailable) {
        setDeviceSupported((prev) => prev || telegramAvailable);
      }
    })();
    (async () => {
      const nativeAvailability = await isNativeBiometricAvailable();
      if (cancelled) return;
      if (nativeAvailability.available) {
        setNativeBiometricSupported(true);
        setDeviceSupported((prev) => prev || nativeAvailability.available);
      }
      const storedNativeId = await loadNativeCredentialId();
      if (!cancelled && storedNativeId) {
        setNativeCredentialId(storedNativeId);
        setDeviceSupported((prev) => prev || true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockWithSecret = useCallback(async (secret) => {
    const ok = await verifySecret(secret);
    if (ok) {
      markUnlockedSession();
      setStatus('unlocked');
      setLastError('');
    } else {
      setLastError('secret_invalid');
    }
    return ok;
  }, []);

  const unlockWithRecovery = useCallback(async (code) => {
    const ok = await verifyRecoveryCode(code);
    if (ok) {
      markUnlockedSession();
      setStatus('unlocked');
      setLastError('');
    } else {
      setLastError('recovery_invalid');
    }
    return ok;
  }, []);

  const unlockWithDevice = useCallback(async () => {
    const storedDeviceId = nativeCredentialId || getDeviceCredentialId();

    if (telegramBiometricSupported || storedDeviceId === TELEGRAM_BIOMETRIC_ID) {
      const result = await authenticateWithTelegramBiometric();
      if (result.ok) {
        markUnlockedSession();
        setStatus('unlocked');
        setLastError('');
        return { ok: true, method: 'telegram_biometric' };
      }
      setLastError(result.error || 'device_failed');
      if (storedDeviceId === TELEGRAM_BIOMETRIC_ID) {
        return { ok: false, error: result.error || 'device_failed' };
      }
    }

    if (nativeBiometricSupported || storedDeviceId === NATIVE_CREDENTIAL_ID) {
      const result = await authenticateNativeBiometric('Unlock your TonPlaygram profile');
      if (result.ok) {
        markUnlockedSession();
        setStatus('unlocked');
        setLastError('');
        return { ok: true, method: 'native_biometric' };
      }
      setLastError(result.error || 'device_failed');
      return { ok: false, error: result.error || 'device_failed' };
    }

    if (!storedDeviceId || !window.PublicKeyCredential) {
      const errorCode = telegramBiometricSupported || nativeBiometricSupported ? 'device_failed' : 'device_unsupported';
      setLastError(errorCode);
      return { ok: false, error: errorCode };
    }
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: bufferFromBase64url(storedDeviceId), type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      if (assertion) {
        markUnlockedSession();
        setStatus('unlocked');
        setLastError('');
        return { ok: true };
      }
    } catch (err) {
      console.error('Device unlock failed', err);
      setLastError('device_failed');
      return { ok: false, error: err?.name || 'device_failed' };
    }
    return { ok: false, error: 'device_failed' };
  }, [nativeBiometricSupported, nativeCredentialId, telegramBiometricSupported]);

  const enableSecretLock = useCallback(async ({ method, secret }) => {
    const result = await setSecretLock({ method, secret });
    if (result.ok) {
      setConfig(loadLockConfig());
      setStatus('locked');
      setIssuedRecoveryCodes(result.recoveryCodes || []);
      setLastError('');
    } else {
      setLastError(result.error || 'unknown');
    }
    return result;
  }, []);

  const enableDeviceLock = useCallback(async () => {
    const telegramAvailable = telegramBiometricSupported || (await isTelegramBiometricAvailable());
    const nativeAvailable = nativeBiometricSupported || (await isNativeBiometricAvailable().then((r) => r.available));
    if (!window.PublicKeyCredential) {
      if (telegramAvailable || nativeAvailable) {
        const idToStore = telegramAvailable ? TELEGRAM_BIOMETRIC_ID : NATIVE_CREDENTIAL_ID;
        storeDeviceCredentialId(idToStore);
        if (idToStore === NATIVE_CREDENTIAL_ID) {
          storeNativeCredentialId(idToStore).catch(() => {});
          setNativeCredentialId(idToStore);
        }
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        if (telegramAvailable) setTelegramBiometricSupported(true);
        if (nativeAvailable) setNativeBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: telegramAvailable ? 'telegram_biometric' : 'native_biometric' };
      }
      setLastError('device_unsupported');
      return { ok: false, error: 'device_unsupported' };
    }
    try {
      const authenticatorAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
      if (authenticatorAvailable === false) {
        if (telegramAvailable || nativeAvailable) {
          const idToStore = telegramAvailable ? TELEGRAM_BIOMETRIC_ID : NATIVE_CREDENTIAL_ID;
          storeDeviceCredentialId(idToStore);
          if (idToStore === NATIVE_CREDENTIAL_ID) {
            storeNativeCredentialId(idToStore).catch(() => {});
            setNativeCredentialId(idToStore);
          }
          setConfig(loadLockConfig());
          setStatus('locked');
          setLastError('');
          if (telegramAvailable) setTelegramBiometricSupported(true);
          if (nativeAvailable) setNativeBiometricSupported(true);
          setDeviceSupported(true);
          return { ok: true, method: telegramAvailable ? 'telegram_biometric' : 'native_biometric' };
        }
        setLastError('device_unsupported');
        return { ok: false, error: 'device_unsupported' };
      }
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'TonPlaygram Profile' },
          user: {
            id: crypto.getRandomValues(new Uint8Array(32)),
            name: `tpc-${Date.now()}`,
            displayName: 'TonPlaygram user'
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000
        }
      });
      if (credential?.rawId) {
        storeDeviceCredentialId(base64urlFromBuffer(credential.rawId));
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        return { ok: true };
      }
    } catch (err) {
      console.error('Failed to register device lock', err);
      if (telegramAvailable || nativeAvailable) {
        const idToStore = telegramAvailable ? TELEGRAM_BIOMETRIC_ID : NATIVE_CREDENTIAL_ID;
        storeDeviceCredentialId(idToStore);
        if (idToStore === NATIVE_CREDENTIAL_ID) {
          storeNativeCredentialId(idToStore).catch(() => {});
          setNativeCredentialId(idToStore);
        }
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        if (telegramAvailable) setTelegramBiometricSupported(true);
        if (nativeAvailable) setNativeBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: telegramAvailable ? 'telegram_biometric' : 'native_biometric' };
      }
      setLastError(err?.name || 'device_failed');
      return { ok: false, error: err?.name || 'device_failed' };
    }
    setLastError('device_failed');
    return { ok: false, error: 'device_failed' };
  }, [nativeBiometricSupported, telegramBiometricSupported]);

  const disableLock = useCallback(() => {
    clearLockConfig();
    clearNativeCredentialId().catch(() => {});
    setConfig(null);
    setStatus('unlocked');
    setLastError('');
  }, []);

  return useMemo(
    () => ({
      config,
      locked,
      status,
      unlockWithSecret,
      unlockWithDevice,
      unlockWithRecovery,
      enableSecretLock,
      enableDeviceLock,
      disableLock,
      issuedRecoveryCodes,
      lastError,
      deviceSupported
    }),
    [
      config,
      locked,
      status,
      unlockWithSecret,
      unlockWithDevice,
      unlockWithRecovery,
      enableSecretLock,
      enableDeviceLock,
      disableLock,
      issuedRecoveryCodes,
      lastError,
      deviceSupported
    ]
  );
}
