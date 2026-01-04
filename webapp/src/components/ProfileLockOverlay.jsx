import React, { useState } from 'react';

export default function ProfileLockOverlay({
  locked,
  onUnlockSecret,
  onUnlockDevice,
  onDisable,
  onConfigureSecret,
  onConfigureDevice
}) {
  const [mode, setMode] = useState('pin');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  if (!locked) return null;

  const submitUnlock = async (evt) => {
    evt.preventDefault();
    setError('');
    const ok = await onUnlockSecret(value);
    if (!ok) setError('That secret did not unlock your profile.');
    setValue('');
  };

  const configure = async (evt) => {
    evt.preventDefault();
    setError('');
    if (!value || value.length < 4) {
      setError('Choose a PIN/pattern/password with at least 4 characters.');
      return;
    }
    const ok = await onConfigureSecret({
      method: mode === 'pattern' ? 'pin' : mode,
      secret: value
    });
    if (ok) {
      setValue('');
      setError('');
    } else {
      setError('Could not save your lock. Try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur px-4">
      <div className="max-w-xl w-full space-y-4 bg-surface border border-border rounded-2xl p-5 shadow-lg">
        <h3 className="text-xl font-bold text-white text-center">Protect your profile</h3>
        <p className="text-sm text-subtext text-center">
          Unlock to view sensitive info, or set a stronger lock that works across browsers. Choose PIN, pattern, password,
          or device biometrics/passkey where available.
        </p>

        <form className="space-y-3" onSubmit={submitUnlock}>
          <label className="text-sm text-white">Enter your PIN / password</label>
          <input
            type="password"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Unlock secret"
          />
          <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-black font-semibold rounded py-2">
            Unlock
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-sm text-white">Or use your device</p>
          <button
            type="button"
            className="w-full border border-border rounded py-2 text-white"
            onClick={onUnlockDevice}
          >
            Unlock with biometrics/passkey
          </button>
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-sm text-white">Set or change your lock</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['pin', 'pattern', 'password'].map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => setMode(option)}
                className={`rounded border px-2 py-1 capitalize ${
                  mode === option ? 'bg-primary text-black' : 'text-white border-border'
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={onConfigureDevice}
              className="col-span-2 rounded border border-border px-2 py-1 text-white"
            >
              Use device biometrics/passkey
            </button>
          </div>
          <form onSubmit={configure} className="space-y-2">
            <input
              type={mode === 'password' ? 'password' : 'text'}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text"
              placeholder={mode === 'password' ? 'New password (min 8 chars)' : 'New PIN / pattern'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-black font-semibold rounded py-2">
              Save lock
            </button>
          </form>
        </div>

        <div className="text-sm text-subtext text-center">
          <button type="button" className="underline" onClick={onDisable}>
            Disable profile lock
          </button>
        </div>

        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
