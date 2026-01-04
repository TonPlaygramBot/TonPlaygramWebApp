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
  checkNativeBiometricAvailable,
  clearNativeCredentialId,
  loadNativeCredentialId,
  saveNativeCredentialId,
  NATIVE_BIOMETRIC_ID
} from '../utils/deviceBiometric.ts';

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
        loadLockConfig()?.credentialId === NATIVE_BIOMETRIC_ID)
  );
  const [nativeBiometricSupported, setNativeBiometricSupported] = useState(false);
  const [telegramBiometricSupported, setTelegramBiometricSupported] = useState(false);
  const locked = status === 'locked';

  useEffect(() => {
    let cancelled = false;
    const currentConfig = loadLockConfig();
    setConfig(currentConfig);
    setStatus(isUnlocked() || !currentConfig ? 'unlocked' : 'locked');
    if (typeof window !== 'undefined') {
      const hasStoredTelegramDevice = currentConfig?.credentialId === TELEGRAM_BIOMETRIC_ID;
      const hasWebAuthn = !!window.PublicKeyCredential;
      setDeviceSupported(hasWebAuthn || hasStoredTelegramDevice);
    }
    (async () => {
      try {
        const storedNative = await loadNativeCredentialId();
        if (cancelled) return;
        if (storedNative) {
          storeDeviceCredentialId(storedNative);
          setConfig(loadLockConfig());
          setStatus(isUnlocked() || !loadLockConfig() ? 'unlocked' : 'locked');
          setNativeBiometricSupported(true);
          setDeviceSupported(true);
        }
      } catch {
        // ignore sync failures
      }
    })();
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
      const nativeAvailable = await checkNativeBiometricAvailable();
      if (cancelled) return;
      setNativeBiometricSupported(nativeAvailable.available);
      if (nativeAvailable.available) setDeviceSupported(true);
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
    const storedDeviceId = getDeviceCredentialId();

    if ((nativeBiometricSupported || storedDeviceId === NATIVE_BIOMETRIC_ID) && !telegramBiometricSupported) {
      const result = await authenticateNativeBiometric();
      if (result.ok) {
        markUnlockedSession();
        setStatus('unlocked');
        setLastError('');
        return { ok: true, method: 'native_biometric' };
      }
      const errorCode = result.error === 'not_configured' ? 'biometric_not_setup' : 'device_failed';
      setLastError(errorCode);
      if (storedDeviceId === NATIVE_BIOMETRIC_ID) {
        return { ok: false, error: errorCode };
      }
    }

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

    if (!storedDeviceId || !window.PublicKeyCredential) {
      const unsupportedMessage = telegramBiometricSupported || nativeBiometricSupported ? 'device_failed' : 'device_unsupported';
      setLastError(unsupportedMessage);
      return { ok: false, error: unsupportedMessage };
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
  }, [nativeBiometricSupported, telegramBiometricSupported]);

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
    const nativeAvailability = await checkNativeBiometricAvailable();
    const nativeAvailable = nativeAvailability.available || nativeBiometricSupported;
    const webAuthnAvailable = typeof window !== 'undefined' && !!window.PublicKeyCredential;
    const preferNative = !window?.Telegram?.WebApp && nativeAvailable;

    if (!webAuthnAvailable && !telegramAvailable && !nativeAvailable) {
      const errorCode =
        nativeAvailability.code === 'biometryNotEnrolled' || nativeAvailability.code === 'passcodeNotSet'
          ? 'biometric_not_setup'
          : 'device_unsupported';
      setLastError(errorCode);
      return { ok: false, error: errorCode };
    }

    if (preferNative && !webAuthnAvailable) {
      storeDeviceCredentialId(NATIVE_BIOMETRIC_ID);
      await saveNativeCredentialId(NATIVE_BIOMETRIC_ID);
      setConfig(loadLockConfig());
      setStatus('locked');
      setLastError('');
      setNativeBiometricSupported(true);
      setDeviceSupported(true);
      return { ok: true, method: 'native_biometric' };
    }

    if (!webAuthnAvailable) {
      if (telegramAvailable) {
        storeDeviceCredentialId(TELEGRAM_BIOMETRIC_ID);
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        setTelegramBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: 'telegram_biometric' };
      }
      if (nativeAvailable) {
        storeDeviceCredentialId(NATIVE_BIOMETRIC_ID);
        await saveNativeCredentialId(NATIVE_BIOMETRIC_ID);
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        setNativeBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: 'native_biometric' };
      }
      setLastError('device_unsupported');
      return { ok: false, error: 'device_unsupported' };
    }
    try {
      const authenticatorAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
      if (authenticatorAvailable === false) {
        if (telegramAvailable) {
          storeDeviceCredentialId(TELEGRAM_BIOMETRIC_ID);
          setConfig(loadLockConfig());
          setStatus('locked');
          setLastError('');
          setTelegramBiometricSupported(true);
          setDeviceSupported(true);
          return { ok: true, method: 'telegram_biometric' };
        }
        if (nativeAvailable) {
          storeDeviceCredentialId(NATIVE_BIOMETRIC_ID);
          await saveNativeCredentialId(NATIVE_BIOMETRIC_ID);
          setConfig(loadLockConfig());
          setStatus('locked');
          setLastError('');
          setNativeBiometricSupported(true);
          setDeviceSupported(true);
          return { ok: true, method: 'native_biometric' };
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
      if (telegramAvailable) {
        storeDeviceCredentialId(TELEGRAM_BIOMETRIC_ID);
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        setTelegramBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: 'telegram_biometric' };
      }
      if (nativeAvailable) {
        storeDeviceCredentialId(NATIVE_BIOMETRIC_ID);
        await saveNativeCredentialId(NATIVE_BIOMETRIC_ID);
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        setNativeBiometricSupported(true);
        setDeviceSupported(true);
        return { ok: true, method: 'native_biometric' };
      }
      setLastError(err?.name || 'device_failed');
      return { ok: false, error: err?.name || 'device_failed' };
    }
    setLastError('device_failed');
    return { ok: false, error: 'device_failed' };
  }, [nativeBiometricSupported, telegramBiometricSupported]);

  const disableLock = useCallback(() => {
    clearLockConfig();
    void clearNativeCredentialId();
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
