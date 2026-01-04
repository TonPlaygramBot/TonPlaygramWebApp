import React, { useMemo, useState } from 'react';

function getErrorMessage(code) {
  switch (code) {
    case 'password_too_short':
      return 'Password must be at least 8 characters.';
    case 'pin_too_short':
      return 'PIN/pattern must be at least 4 characters.';
    case 'hash_failed':
      return 'Could not secure your secret. Please try again.';
    case 'device_unsupported':
      return 'This device or browser does not support passkeys/biometrics.';
    case 'device_not_configured':
      return 'Biometrics are not set up on this device. Configure Face ID / Touch ID or device unlock first.';
    case 'device_failed':
      return 'We could not complete biometric unlock on this device.';
    case 'secret_invalid':
      return 'That PIN/password did not unlock your profile.';
    case 'recovery_invalid':
      return 'Recovery code not recognized or already used.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function ProfileLockOverlay({
  locked,
  onUnlockSecret,
  onUnlockDevice,
  onUnlockRecovery,
  onDisable,
  onConfigureSecret,
  onConfigureDevice,
  deviceSupported = true,
  issuedRecoveryCodes = [],
  lastError
}) {
  const [mode, setMode] = useState('pin');
  const [value, setValue] = useState('');
  const [recoveryValue, setRecoveryValue] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');

  const currentError = useMemo(() => localError || (lastError ? getErrorMessage(lastError) : ''), [localError, lastError]);

  if (!locked) return null;

  const submitUnlock = async (evt) => {
    evt.preventDefault();
    setLocalError('');
    setSuccess('');
    const ok = await onUnlockSecret(value);
    if (!ok) setLocalError('secret_invalid');
    setValue('');
  };

  const submitRecovery = async (evt) => {
    evt.preventDefault();
    setLocalError('');
    setSuccess('');
    const ok = await onUnlockRecovery(recoveryValue);
    if (!ok) setLocalError('recovery_invalid');
    else setSuccess('Recovered access. Update your lock next.');
    setRecoveryValue('');
  };

  const configure = async (evt) => {
    evt.preventDefault();
    setLocalError('');
    setSuccess('');
    if (!value || value.length < 4) {
      setLocalError('pin_too_short');
      return;
    }
    const result = await onConfigureSecret({
      method: mode === 'pattern' ? 'pin' : mode,
      secret: value
    });
    if (result.ok) {
      setValue('');
      setSuccess('Lock updated. Save your recovery codes below.');
    } else {
      setLocalError(result.error || 'unknown');
    }
  };

  const useDevice = async () => {
    setLocalError('');
    setSuccess('');
    const result = await onUnlockDevice();
    if (!result?.ok) {
      setLocalError(result?.error || 'device_failed');
    } else {
      setSuccess('Unlocked with your device.');
    }
  };

  const registerDevice = async () => {
    setLocalError('');
    setSuccess('');
    const result = await onConfigureDevice();
    if (result?.ok) {
      setSuccess('Device lock added. Use biometrics next time.');
    } else {
      setLocalError(result?.error || 'device_failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur px-4 py-6 sm:py-10 overflow-y-auto">
      <div className="max-w-4xl w-full space-y-4 bg-surface border border-border rounded-2xl p-5 shadow-lg">
        <h3 className="text-2xl font-bold text-white text-center">Protect your profile</h3>
        <p className="text-sm text-subtext text-center">
          Unlock to view sensitive info, or set a stronger lock that works across browsers. Use PIN, pattern, password, device
          biometrics/passkey, and keep recovery codes handy.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <h4 className="font-semibold text-white">Unlock access</h4>
            <form className="space-y-3" onSubmit={submitUnlock}>
              <label className="text-xs text-subtext">PIN / password</label>
              <input
                type="password"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter your secret"
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-black font-semibold rounded py-2"
              >
                Unlock with secret
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-xs text-subtext">Recovery code</p>
              <form onSubmit={submitRecovery} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text"
                  value={recoveryValue}
                  onChange={(e) => setRecoveryValue(e.target.value)}
                  placeholder="XXXX-XXXX"
                  autoComplete="one-time-code"
                />
                <button
                  type="submit"
                  className="w-full sm:w-40 bg-surface text-white border border-border rounded py-2 text-sm"
                >
                  Use recovery
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-subtext">Device unlock</p>
              <button
                type="button"
                className="w-full border border-border rounded py-2 text-white disabled:opacity-50"
                onClick={useDevice}
                disabled={!deviceSupported}
              >
                Unlock with biometrics/passkey
              </button>
              {!deviceSupported && (
                <p className="text-xs text-amber-300">
                  Your current browser does not support passkeys. Try a modern mobile browser.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <h4 className="font-semibold text-white">Update your lock</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {['pin', 'pattern', 'password'].map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setMode(option)}
                  className={`rounded border px-2 py-2 capitalize ${
                    mode === option ? 'bg-primary text-black' : 'text-white border-border'
                  }`}
                >
                  {option}
                </button>
              ))}
              <button
                type="button"
                onClick={registerDevice}
                className="col-span-2 rounded border border-border px-2 py-2 text-white disabled:opacity-50"
                disabled={!deviceSupported}
              >
                Add device biometrics/passkey
              </button>
            </div>
            <form onSubmit={configure} className="space-y-2">
              <input
                type={mode === 'password' ? 'password' : 'text'}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text"
                placeholder={mode === 'password' ? 'New password (min 8 chars)' : 'New PIN / pattern'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-black font-semibold rounded py-2"
              >
                Save lock
              </button>
            </form>
            {issuedRecoveryCodes.length > 0 && (
              <div className="rounded border border-border bg-black/30 p-3 space-y-1">
                <p className="text-xs text-amber-200">Save these one-time recovery codes:</p>
                <div className="flex flex-wrap gap-2 text-sm text-white font-mono">
                  {issuedRecoveryCodes.map((code) => (
                    <span key={code} className="px-2 py-1 rounded bg-surface/80 border border-border">
                      {code}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-subtext">Codes disappear after you leave this screen. Store them safely.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button type="button" className="underline text-white" onClick={onDisable}>
            Disable profile lock
          </button>
          {success && <span className="text-green-400">{success}</span>}
          {currentError && <span className="text-red-400">{getErrorMessage(currentError)}</span>}
        </div>
      </div>
    </div>
  );
}
