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

export default function useProfileLock() {
  const [config, setConfig] = useState(() => loadLockConfig());
  const [status, setStatus] = useState(() => (isUnlocked() || !config ? 'unlocked' : 'locked'));
  const [issuedRecoveryCodes, setIssuedRecoveryCodes] = useState([]);
  const [lastError, setLastError] = useState('');
  const [deviceSupported, setDeviceSupported] = useState(
    typeof window !== 'undefined' && !!window.PublicKeyCredential
  );
  const locked = status === 'locked';

  useEffect(() => {
    setConfig(loadLockConfig());
    setStatus(isUnlocked() || !loadLockConfig() ? 'unlocked' : 'locked');
    if (typeof window !== 'undefined' && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setDeviceSupported(Boolean(available)))
        .catch(() => setDeviceSupported(false));
    }
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
