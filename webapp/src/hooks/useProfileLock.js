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

const TELEGRAM_BIOMETRIC_REASON = 'Use your fingerprint or Face ID to secure your profile.';
const TELEGRAM_UNLOCK_REASON = 'Confirm to unlock your TonPlaygram profile.';

const getTelegramBiometricManager = () => {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp?.BiometricManager || window.Telegram?.WebApp?.biometricManager || null;
};

const initTelegramBiometrics = async (manager) =>
  new Promise((resolve) => {
    let settled = false;
    try {
      const maybe = manager?.init?.(() => {
        settled = true;
        resolve(true);
      });
      if (maybe?.then) {
        maybe.then(() => {
          settled = true;
          resolve(true);
        }).catch(() => {
          settled = true;
          resolve(false);
        });
      }
      setTimeout(() => {
        if (!settled) resolve(true);
      }, 300);
    } catch (err) {
      console.error('Telegram biometric init failed', err);
      resolve(false);
    }
  });

const requestTelegramBiometricAccess = async (manager) =>
  new Promise((resolve) => {
    let settled = false;
    try {
      manager?.requestAccess?.({ reason: TELEGRAM_BIOMETRIC_REASON }, (granted) => {
        settled = true;
        resolve(Boolean(granted));
      });
      setTimeout(() => {
        if (!settled) resolve(Boolean(manager?.isAccessGranted || manager?.isAccessRequested));
      }, 500);
    } catch (err) {
      console.error('Telegram biometric access failed', err);
      resolve(false);
    }
  });

const authenticateTelegramBiometric = async (manager, reason = TELEGRAM_UNLOCK_REASON) =>
  new Promise((resolve) => {
    let settled = false;
    try {
      manager?.authenticate?.({ reason }, (ok, token) => {
        settled = true;
        resolve({ ok: Boolean(ok), token });
      });
      setTimeout(() => {
        if (!settled) resolve({ ok: false });
      }, 1500);
    } catch (err) {
      console.error('Telegram biometric auth failed', err);
      resolve({ ok: false, error: err?.message || 'device_failed' });
    }
  });

const updateTelegramBiometricToken = async (manager, token) =>
  new Promise((resolve) => {
    let settled = false;
    try {
      manager?.updateBiometricToken?.(token, (ok) => {
        settled = true;
        resolve(Boolean(ok));
      });
      setTimeout(() => {
        if (!settled) resolve(true);
      }, 500);
    } catch (err) {
      console.error('Telegram biometric token update failed', err);
      resolve(false);
    }
  });

const generateBiometricToken = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
};

export default function useProfileLock() {
  const [config, setConfig] = useState(() => loadLockConfig());
  const [status, setStatus] = useState(() => (isUnlocked() || !config ? 'unlocked' : 'locked'));
  const [issuedRecoveryCodes, setIssuedRecoveryCodes] = useState([]);
  const [lastError, setLastError] = useState('');
  const [deviceSupported, setDeviceSupported] = useState(
    typeof window !== 'undefined' && (!!window.PublicKeyCredential || !!getTelegramBiometricManager())
  );
  const locked = status === 'locked';

  useEffect(() => {
    let cancelled = false;
    setConfig(loadLockConfig());
    setStatus(isUnlocked() || !loadLockConfig() ? 'unlocked' : 'locked');
    if (typeof window !== 'undefined' && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          if (!cancelled) setDeviceSupported(Boolean(available));
        })
        .catch(() => {
          if (!cancelled) setDeviceSupported(false);
        });
    }
    const telegramManager = getTelegramBiometricManager();
    if (telegramManager) {
      initTelegramBiometrics(telegramManager).then(() => {
        if (cancelled) return;
        const supported = telegramManager.isBiometricAvailable;
        setDeviceSupported(supported === undefined ? true : Boolean(supported));
      });
    }
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
    const cfg = loadLockConfig();
    const telegramManager = getTelegramBiometricManager();
    if (cfg?.telegramBiometric && telegramManager) {
      try {
        await initTelegramBiometrics(telegramManager);
        if (telegramManager.isBiometricAvailable === false) {
          setLastError('device_unsupported');
          return { ok: false, error: 'device_unsupported' };
        }
        const result = await authenticateTelegramBiometric(telegramManager, TELEGRAM_UNLOCK_REASON);
        if (result.ok && (!cfg.deviceToken || !result.token || cfg.deviceToken === result.token)) {
          markUnlockedSession();
          setStatus('unlocked');
          setLastError('');
          return { ok: true };
        }
        setLastError('device_failed');
        return { ok: false, error: 'device_failed' };
      } catch (err) {
        console.error('Device unlock failed', err);
        setLastError('device_failed');
        return { ok: false, error: err?.message || 'device_failed' };
      }
    }

    const id = getDeviceCredentialId();
    if (!id || !window.PublicKeyCredential) {
      setLastError('device_unsupported');
      return { ok: false, error: 'device_unsupported' };
    }
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: bufferFromBase64url(id), type: 'public-key' }],
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
  }, []);

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
    const telegramManager = getTelegramBiometricManager();
    if (telegramManager) {
      try {
        await initTelegramBiometrics(telegramManager);
        if (telegramManager.isBiometricAvailable === false) {
          setLastError('device_unsupported');
          return { ok: false, error: 'device_unsupported' };
        }
        if (!telegramManager.isAccessGranted) {
          const granted = await requestTelegramBiometricAccess(telegramManager);
          if (!granted) {
            setLastError('device_failed');
            return { ok: false, error: 'device_failed' };
          }
        }
        const token = generateBiometricToken();
        const authenticated = await authenticateTelegramBiometric(telegramManager, TELEGRAM_BIOMETRIC_REASON);
        if (!authenticated.ok) {
          setLastError(authenticated.error || 'device_failed');
          return { ok: false, error: authenticated.error || 'device_failed' };
        }
        await updateTelegramBiometricToken(telegramManager, token);
        storeDeviceCredentialId('telegram-biometric', { telegramBiometric: true, deviceToken: token });
        setConfig(loadLockConfig());
        setStatus('locked');
        setLastError('');
        setDeviceSupported(true);
        return { ok: true };
      } catch (err) {
        console.error('Failed to register Telegram biometrics', err);
        setLastError(err?.name || 'device_failed');
        return { ok: false, error: err?.name || 'device_failed' };
      }
    }

    if (!window.PublicKeyCredential) {
      setLastError('device_unsupported');
      return { ok: false, error: 'device_unsupported' };
    }
    try {
      const authenticatorAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
      if (authenticatorAvailable === false) {
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
      setLastError(err?.name || 'device_failed');
      return { ok: false, error: err?.name || 'device_failed' };
    }
    setLastError('device_failed');
    return { ok: false, error: 'device_failed' };
  }, []);

  const disableLock = useCallback(() => {
    clearLockConfig();
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
