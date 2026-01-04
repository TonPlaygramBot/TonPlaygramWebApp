import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearLockConfig,
  getDeviceCredentialId,
  isUnlocked,
  loadLockConfig,
  markUnlockedSession,
  setSecretLock,
  storeDeviceCredentialId,
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
  const locked = status === 'locked';

  useEffect(() => {
    setConfig(loadLockConfig());
    setStatus(isUnlocked() || !loadLockConfig() ? 'unlocked' : 'locked');
  }, []);

  const unlockWithSecret = useCallback(async (secret) => {
    const ok = await verifySecret(secret);
    if (ok) {
      markUnlockedSession();
      setStatus('unlocked');
    }
    return ok;
  }, []);

  const unlockWithDevice = useCallback(async () => {
    const id = getDeviceCredentialId();
    if (!id || !window.PublicKeyCredential) return false;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ id: bufferFromBase64url(id), type: 'public-key' }],
          userVerification: 'preferred'
        }
      });
      if (assertion) {
        markUnlockedSession();
        setStatus('unlocked');
        return true;
      }
    } catch (err) {
      console.error('Device unlock failed', err);
    }
    return false;
  }, []);

  const enableSecretLock = useCallback(async ({ method, secret }) => {
    const ok = await setSecretLock({ method, secret });
    if (ok) {
      setConfig(loadLockConfig());
      setStatus('locked');
    }
    return ok;
  }, []);

  const enableDeviceLock = useCallback(async () => {
    if (!window.PublicKeyCredential) return false;
    try {
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
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'preferred' }
        }
      });
      if (credential?.rawId) {
        storeDeviceCredentialId(base64urlFromBuffer(credential.rawId));
        setConfig(loadLockConfig());
        setStatus('locked');
        return true;
      }
    } catch (err) {
      console.error('Failed to register device lock', err);
    }
    return false;
  }, []);

  const disableLock = useCallback(() => {
    clearLockConfig();
    setConfig(null);
    setStatus('unlocked');
  }, []);

  return useMemo(
    () => ({
      config,
      locked,
      status,
      unlockWithSecret,
      unlockWithDevice,
      enableSecretLock,
      enableDeviceLock,
      disableLock
    }),
    [
      config,
      locked,
      status,
      unlockWithSecret,
      unlockWithDevice,
      enableSecretLock,
      enableDeviceLock,
      disableLock
    ]
  );
}
