import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSecureAuth } from '../hooks/useSecureAuth.js';

async function authenticateBiometric() {
  try {
    const publicKey = {
      challenge: new Uint8Array(32),
      userVerification: 'preferred',
      timeout: 60000,
    };
    const cred = await navigator.credentials.get({ publicKey });
    return cred !== null;
  } catch {
    return false;
  }
}

async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function UnlockModal({ open }) {
  const { login } = useSecureAuth();
  const [mode, setMode] = useState(null); // null | 'pin'
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const storedHash = localStorage.getItem('pinHash');

  if (!open) return null;

  const handleBiometric = async () => {
    const ok = await authenticateBiometric();
    if (ok) login();
    else setError('Biometric authentication failed');
  };

  const handlePinSubmit = async () => {
    if (!storedHash) {
      if (pin.length < 4 || pin.length > 6 || pin !== confirm) {
        setError('PINs must match and be 4-6 digits');
        return;
      }
      const h = await hashPin(pin);
      localStorage.setItem('pinHash', h);
      login();
      return;
    }
    const h = await hashPin(pin);
    if (h === storedHash) {
      login();
    } else {
      setError('Incorrect PIN');
    }
  };

  const renderPin = () => (
    <div className="space-y-2">
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Enter PIN"
        className="w-full p-2 bg-black bg-opacity-30 border border-gray-700"
      />
      {!storedHash && (
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm PIN"
          className="w-full p-2 bg-black bg-opacity-30 border border-gray-700"
        />
      )}
      <button onClick={handlePinSubmit} className="lobby-tile w-full">
        Submit
      </button>
      <button onClick={() => { setMode(null); setError(''); }} className="lobby-tile w-full">
        Back
      </button>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 space-y-4 text-text w-80">
        <h3 className="text-lg font-bold text-center">For your security, unlock your account.</h3>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {mode === 'pin' ? (
          renderPin()
        ) : (
          <div className="space-y-2">
            <button onClick={handleBiometric} className="lobby-tile w-full">
              Use Fingerprint / Face ID
            </button>
            <button onClick={() => { setMode('pin'); setError(''); }} className="lobby-tile w-full">
              Use PIN
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
