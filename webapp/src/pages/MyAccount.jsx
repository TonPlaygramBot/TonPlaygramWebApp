import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import {
  getAccountInfo,
  createAccount,
  updateProfile,
  fetchTelegramInfo,
  depositAccount,
  sendBroadcast,
  linkSocial,
  getUnreadCount,
  linkGoogleAccount
} from '../utils/api.js';
import {
  getTelegramId,
  getTelegramFirstName,
  getTelegramLastName,
  getTelegramPhotoUrl,
  clearTelegramCache
} from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { DEV_INFO } from '../utils/constants.js';
import BalanceSummary from '../components/BalanceSummary.jsx';
import AvatarPickerModal from '../components/AvatarPickerModal.jsx';
import AvatarPromptModal from '../components/AvatarPromptModal.jsx';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';
import InfoPopup from '../components/InfoPopup.jsx';
import DevNotifyModal from '../components/DevNotifyModal.jsx';
import InfluencerClaimsCard from '../components/InfluencerClaimsCard.jsx';
import DevTasksModal from '../components/DevTasksModal.jsx';
import Wallet from './Wallet.jsx';
import LinkGoogleButton from '../components/LinkGoogleButton.jsx';
import { loadGoogleProfile, clearGoogleProfile } from '../utils/google.js';
import useProfileLock from '../hooks/useProfileLock.js';
import ProfileLockOverlay from '../components/ProfileLockOverlay.jsx';

import { FiCopy } from 'react-icons/fi';

export default function MyAccount() {
  const [telegramId, setTelegramId] = useState(() => {
    try {
      return getTelegramId();
    } catch {
      return null;
    }
  });
  const [googleProfile, setGoogleProfile] = useState(() => (telegramId ? null : loadGoogleProfile()));
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [manualTelegramInput, setManualTelegramInput] = useState('');
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState('');
  const [tonWalletAddress, setTonWalletAddress] = useState(() => localStorage.getItem('walletAddress') || '');
  const connectedTonAddress = useTonAddress();
  const {
    config: lockConfig,
    locked: profileLocked,
    unlockWithSecret,
    unlockWithDevice,
    unlockWithRecovery,
    enableSecretLock,
    enableDeviceLock,
    disableLock,
    issuedRecoveryCodes,
    lastError: lockError,
    deviceSupported
  } = useProfileLock();

  const [profile, setProfile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef(null);
  const DEV_ACCOUNT_ID = DEV_INFO.account;
  const [devTopup, setDevTopup] = useState('');
  const [devTopupSending, setDevTopupSending] = useState(false);
  const [notifyText, setNotifyText] = useState('');
  const [notifyPhoto, setNotifyPhoto] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [twitterError, setTwitterError] = useState('');
  const [twitterLink, setTwitterLink] = useState('');
  const [unread, setUnread] = useState(0);
  const [googleLinked, setGoogleLinked] = useState(!!googleProfile?.id);
  const [lockMessage, setLockMessage] = useState('');
  const [lockMessageTone, setLockMessageTone] = useState('info');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState([]);
  const requiresAuth = !telegramId && !googleProfile?.id && !tonWalletAddress;

  useEffect(() => {
    setGoogleLinked(Boolean(googleProfile?.id));
  }, [googleProfile?.id]);

  useEffect(() => {
    if (connectedTonAddress) {
      localStorage.setItem('walletAddress', connectedTonAddress);
      setTonWalletAddress(connectedTonAddress);
    }
  }, [connectedTonAddress]);

  const handleSignOut = () => {
    clearGoogleProfile();
    clearTelegramCache();
    localStorage.removeItem('accountId');
    localStorage.removeItem('walletAddress');
    sessionStorage.clear();
    setTelegramId(null);
    setGoogleProfile(null);
    setProfile(null);
    window.location.href = '/';
  };

  useEffect(() => {
    const syncTelegramId = () => {
      try {
        setTelegramId(getTelegramId());
      } catch {
        setTelegramId(null);
      }
    };
    window.addEventListener('storage', syncTelegramId);
    const syncGoogle = () => setGoogleProfile(loadGoogleProfile());
    window.addEventListener('googleProfileUpdated', syncGoogle);
    return () => {
      window.removeEventListener('storage', syncTelegramId);
      window.removeEventListener('googleProfileUpdated', syncGoogle);
    };
  }, []);

  useEffect(() => {
    async function load() {
      setLoadingProfile(true);
      setLoadError('');
      const accountPayload = await createAccount(telegramId, googleProfile, undefined, tonWalletAddress);
      if (accountPayload?.error || !accountPayload?.accountId) {
        throw new Error(accountPayload?.error || 'Unable to load your TPC account. Please try again.');
      }
      if (accountPayload.accountId) {
        localStorage.setItem('accountId', accountPayload.accountId);
      }
      const walletToStore = accountPayload.walletAddress || tonWalletAddress;
      if (walletToStore) {
        localStorage.setItem('walletAddress', walletToStore);
        setTonWalletAddress(walletToStore);
      }

      const data = await getAccountInfo(accountPayload.accountId);
      if (!data || data?.error) {
        throw new Error(data?.error || 'Unable to fetch your profile.');
      }

      let finalProfile = data;

      if (telegramId && (!data.photo || !data.firstName || !data.lastName)) {
        setAutoUpdating(true);

        try {
          let tg;
          try {
            tg = await fetchTelegramInfo(telegramId);
          } catch (err) {
            console.error('fetchTelegramInfo failed', err);
          }

          const firstName =
            data.firstName || tg?.firstName || getTelegramFirstName();
          const lastName =
            data.lastName || tg?.lastName || getTelegramLastName();
          const photo = data.photo || tg?.photoUrl || getTelegramPhotoUrl();

          const updated = await updateProfile({
            telegramId,
            nickname: data.nickname || firstName,
            photo,
            firstName,
            lastName
          });

          const hasRealPhoto = updated.photo || tg?.photoUrl;
          const mergedProfile = {
            ...data,
            ...updated,
            photo: hasRealPhoto || getTelegramPhotoUrl()
          };

          finalProfile = mergedProfile;
        } finally {
          setAutoUpdating(false);
        }
      }

      setProfile(finalProfile);
      setGoogleLinked(Boolean(finalProfile.googleId || googleProfile?.id));
      setTwitterLink(finalProfile.social?.twitter || '');
      const defaultPhoto = telegramId ? getTelegramPhotoUrl() : googleProfile?.photo || '';
      setPhotoUrl(loadAvatar() || finalProfile.photo || defaultPhoto);
      try {
        if (telegramId) {
          const res = await getUnreadCount(telegramId);
          if (!res.error) setUnread(res.count);
        }
      } catch {}
      if (!localStorage.getItem('avatarPromptShown')) {
        setShowAvatarPrompt(true);
      }
    }

    if (requiresAuth) {
      setProfile(null);
      setLoadingProfile(false);
      setLoadError('');
      return () => {};
    }

    let cancelled = false;

    load()
      .catch((err) => {
        console.error('Failed to load account', err);
        if (!cancelled) {
          setLoadError(err?.message || 'Unable to load your profile right now.');
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelled = true;
    };
  }, [telegramId, googleProfile?.id, requiresAuth, reloadNonce]);

  useEffect(() => {
    if (!telegramId && googleProfile?.photo) {
      setPhotoUrl((prev) => prev || googleProfile.photo);
    }
  }, [telegramId, googleProfile?.photo]);

  useEffect(() => {
    if (!telegramId) return;
    async function updatePhoto() {
      try {
        const info = await fetchTelegramInfo(telegramId);
        if (info?.photoUrl) setPhotoUrl(info.photoUrl);
      } catch (err) {
        console.error('fetchTelegramInfo failed', err);
      }
    }
    updatePhoto();
    const handler = () => setPhotoUrl(loadAvatar() || getTelegramPhotoUrl());
    window.addEventListener('profilePhotoUpdated', handler);
    return () => window.removeEventListener('profilePhotoUpdated', handler);
  }, [telegramId]);

  const handleLinkTelegram = async () => {
    if (!googleProfile?.id) return;
    const cleaned = manualTelegramInput.trim();
    if (!cleaned) {
      setLinkFeedback('Enter your Telegram @username or ID to link it.');
      return;
    }
    setLinkFeedback('');
    setLinkingTelegram(true);
    const parsedId = Number(cleaned);
    const telegramIdentifier = Number.isNaN(parsedId) ? cleaned : parsedId;
    try {
      await linkGoogleAccount({
        telegramId: telegramIdentifier,
        googleId: googleProfile.id,
        email: googleProfile.email,
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        photo: googleProfile.photo
      });
      await createAccount(telegramIdentifier, googleProfile, profile?.accountId);
      localStorage.setItem('telegramId', telegramIdentifier);
      setTelegramId(telegramIdentifier);
      setGoogleLinked(true);
      setManualTelegramInput('');
      setLinkFeedback('Telegram linked. We refreshed your TPC profile.');
      setReloadNonce((n) => n + 1);
    } catch (err) {
      console.error('Failed to link Telegram account', err);
      setLinkFeedback('We could not link that Telegram account. Double-check the ID and try again.');
    } finally {
      setLinkingTelegram(false);
    }
  };

  if (requiresAuth) {
    return (
      <LoginOptions
        onAuthenticated={setGoogleProfile}
        onTonConnected={setTonWalletAddress}
      />
    );
  }

  if (!profile) {
    return (
      <div className="p-4 space-y-3 text-text">
        {loadError ? (
          <div className="p-3 rounded-lg border border-red-500 bg-red-500/10 text-sm text-red-200">
            {loadError}
          </div>
        ) : null}
        <div className="p-3 rounded-lg border border-border bg-surface/60 text-subtext">
          {loadingProfile ? 'Loading your profile…' : 'We are getting your profile ready.'}
        </div>
        <button
          className="px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold"
          onClick={() => setReloadNonce((n) => n + 1)}
          disabled={loadingProfile}
        >
          Retry
        </button>
      </div>
    );
  }

  const photoToShow = photoUrl || getTelegramPhotoUrl() || googleProfile?.photo || '';

  const handleDevTopup = async () => {
    const amt = Number(devTopup);
    if (!amt) return;
    setDevTopupSending(true);
    try {
      const res = await depositAccount(DEV_ACCOUNT_ID, amt);
      if (!res?.error) {
        // top up successful
      }
    } catch (err) {
      console.error('top up failed', err);
    } finally {
      setDevTopup('');
      setDevTopupSending(false);
    }
  };

  const handleDevNotify = async () => {
    if (!notifyText && !notifyPhoto) return;
    setNotifySending(true);
    try {
      const res = await sendBroadcast({ text: notifyText, photo: notifyPhoto });
      if (res?.error) {
        setNotifyStatus(res.error);
      } else {
        setNotifyStatus('Notification sent');
      }
    } catch (err) {
      console.error('notify failed', err);
      setNotifyStatus('Failed to send');
    } finally {
      setNotifyText('');
      setNotifyPhoto('');
      setNotifySending(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setNotifyStatus(''), 1500);
    }
  };

  const handleConnectTwitter = async () => {
    setTwitterError('');
    if (!telegramId) {
      setTwitterError('Connect Telegram first to link X.');
      return;
    }
    try {
      const res = await fetch('/api/twitter/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId })
      }).then((r) => r.json());
      if (res.url) {
        window.open(res.url, '_blank');
      } else if (res.error) {
        setTwitterError(res.error);
      }
    } catch (err) {
      console.error('connect x failed', err);
      setTwitterError('Failed to start X auth');
    }
  };

  const handleClearTwitter = async () => {
    setTwitterError('');
    try {
      const res = await linkSocial({ telegramId, twitter: '' });
      if (res?.error) {
        setTwitterError(res.error);
      } else {
        setProfile((p) => ({ ...p, social: res.social }));
      }
    } catch (err) {
      console.error('clear twitter failed', err);
      setTwitterError('Failed to clear');
    }
  };

  const handleSaveTwitter = async () => {
    setTwitterError('');
    try {
      const res = await linkSocial({ telegramId, twitter: twitterLink });
      if (res?.error) {
        setTwitterError(res.error);
      } else {
        setProfile((p) => ({ ...p, social: res.social }));
        setTwitterLink(res.social?.twitter || '');
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1500);
      }
    } catch (err) {
      console.error('save twitter failed', err);
      setTwitterError('Failed to save');
    }
  };

  const friendlyLockError = (code) => {
    switch (code) {
      case 'password_too_short':
        return 'Password must be at least 8 characters.';
      case 'pin_too_short':
        return 'PIN or pattern should be at least 4 characters.';
      case 'device_unsupported':
        return 'Your browser/device does not support passkeys or biometrics.';
      case 'device_failed':
        return 'We could not complete a biometric request. Try again or re-register.';
      case 'biometric_not_setup':
        return 'Biometrics are not configured on this device. Set them up in settings first.';
      default:
        return 'Could not update the lock. Please try again.';
    }
  };

  const setLockFeedback = (message, tone = 'info') => {
    setLockMessage(message);
    setLockMessageTone(tone);
  };

  const handleSecretLock = async ({ method, label }) => {
    const prompts = {
      pin: 'Set a PIN (4-10 digits)',
      password: 'Set a strong password (min 8 chars)',
      pattern: 'Set a pattern (4-10 characters)'
    };
    const secret = prompt(prompts[method]) || '';
    if (!secret) return;
    const result = await enableSecretLock({ method, secret });
    if (result.ok) {
      setLockFeedback(`${label} enabled. Save your recovery codes below.`, 'success');
      setShowRecoveryCodes(result.recoveryCodes || issuedRecoveryCodes || []);
    } else {
      setLockFeedback(friendlyLockError(result.error), 'error');
    }
  };

  const handleDeviceLock = async () => {
    const result = await enableDeviceLock();
    if (result.ok) {
      setLockFeedback('Device biometric/passkey lock enabled. Use your device unlock to enter.', 'success');
    } else {
      setLockFeedback(friendlyLockError(result.error), 'error');
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text wide-card">
      <ProfileLockOverlay
        locked={profileLocked}
        onUnlockSecret={unlockWithSecret}
        onUnlockDevice={unlockWithDevice}
        onUnlockRecovery={unlockWithRecovery}
        onDisable={disableLock}
        onConfigureSecret={enableSecretLock}
        onConfigureDevice={enableDeviceLock}
        deviceSupported={deviceSupported}
        issuedRecoveryCodes={showRecoveryCodes.length ? showRecoveryCodes : issuedRecoveryCodes}
        lastError={lockError}
      />
      <AvatarPromptModal
        open={showAvatarPrompt}
        onPick={() => {
          localStorage.setItem('avatarPromptShown', 'true');
          setShowAvatarPrompt(false);
          setShowAvatarPicker(true);
        }}
        onKeep={() => {
          localStorage.setItem('avatarPromptShown', 'true');
          setShowAvatarPrompt(false);
        }}
      />
      <AvatarPickerModal
        open={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSave={async (src) => {
          const updated = await updateProfile({ telegramId, photo: src });
          saveAvatar(src);
          setProfile(updated);
          setShowAvatarPicker(false);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 1500);
          window.dispatchEvent(new Event('profilePhotoUpdated'));
        }}
      />
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">
          Updating with Telegram info...
        </div>
      )}

      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-bold">My Account</h2>
      </div>

      <div className="flex items-center space-x-4">
        {photoToShow && (
          <img
            src={getAvatarUrl(photoToShow)}
            alt="avatar"
            className="w-14 h-14 rounded-full object-cover"
          />
        )}
        <div>
          <p className="font-semibold text-yellow-400 text-outline-black">
            {profile.firstName} {profile.lastName}
          </p>
          <div className="text-sm flex items-center space-x-1">
            <span className="text-white-shadow">Account:</span>
            <span className="text-yellow-400 text-outline-black">
              {profile.accountId}
            </span>
            <FiCopy
              className="w-4 h-4 cursor-pointer"
              onClick={() =>
                navigator.clipboard.writeText(String(profile.accountId))
              }
            />
          </div>
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="mt-2 px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
          >
            Change Avatar
          </button>
          <button
            onClick={async () => {
              const url = getTelegramPhotoUrl();
              const updated = await updateProfile({ telegramId, photo: url });
              localStorage.removeItem('profilePhoto');
              setProfile(updated);
              setShowSaved(true);
              setTimeout(() => setShowSaved(false), 1500);
              window.dispatchEvent(new Event('profilePhotoUpdated'));
            }}
            className="mt-2 ml-2 px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
          >
            Use Telegram Photo
          </button>
          <div className="mt-2">
            <a
              href="/messages"
              className="underline text-red-600 text-outline-white relative"
            >
              Inbox
              {unread > 0 && (
                <span className="absolute -top-1 -right-3 bg-red-600 text-background text-xs rounded-full px-1">
                  {unread}
                </span>
              )}
            </a>
          </div>
          {telegramId && !googleLinked && (
            <div className="mt-2">
              <p className="text-sm mb-1 text-white-shadow">
                Link your Google account:
              </p>
              <LinkGoogleButton
                telegramId={telegramId}
                onLinked={() => setGoogleLinked(true)}
              />
            </div>
          )}
          {!telegramId && googleProfile?.id && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-white-shadow">
                Link your Telegram account to sync rewards across Chrome and the mini app.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  value={manualTelegramInput}
                  onChange={(e) => setManualTelegramInput(e.target.value)}
                  placeholder="@username or Telegram ID"
                  className="border p-2 rounded text-black w-full sm:max-w-xs"
                />
                <button
                  onClick={handleLinkTelegram}
                  disabled={linkingTelegram}
                  className="px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold disabled:opacity-60"
                >
                  {linkingTelegram ? 'Linking…' : 'Link Telegram'}
                </button>
              </div>
              {linkFeedback && <p className="text-xs text-amber-200">{linkFeedback}</p>}
            </div>
          )}
          {profile.social?.twitter && (
            <p className="text-sm mt-2">
              <span className="text-white text-outline-black">Linked X:</span> @
              {profile.social.twitter}{' '}
              <button
                onClick={handleClearTwitter}
                className="underline text-primary ml-1"
              >
                Clear
              </button>
            </p>
          )}
          <div className="mt-2 flex items-center space-x-2">
            <input
              type="text"
              placeholder="X profile link"
              value={twitterLink}
              onChange={(e) => setTwitterLink(e.target.value)}
              className="border p-1 rounded text-black flex-grow"
            />
            <button
              onClick={handleSaveTwitter}
              className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
            >
              Save
            </button>
            <button
              onClick={handleConnectTwitter}
              className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow text-sm"
            >
              Connect
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-white">Profile protection</p>
            <p className="text-xs text-subtext">
              Lock this page with a PIN, pattern, password, or device biometrics/passkey. Unlocking works across browsers, with
              recovery codes for emergencies.
            </p>
            <ul className="mt-2 text-xs text-subtext list-disc list-inside space-y-1">
              <li>Use biometrics/passkeys when your device supports them.</li>
              <li>Create a backup PIN or password for other browsers.</li>
              <li>Store recovery codes offline to avoid lockouts.</li>
            </ul>
          </div>
          <button
            onClick={handleSignOut}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
          >
            Sign out
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1 bg-primary hover:bg-primary-hover text-black rounded text-sm"
            onClick={() => handleSecretLock({ method: 'pin', label: 'PIN / Pattern lock' })}
          >
            Set PIN / Pattern
          </button>
          <button
            className="px-3 py-1 bg-primary hover:bg-primary-hover text-black rounded text-sm"
            onClick={() => handleSecretLock({ method: 'password', label: 'Password lock' })}
          >
            Set Password
          </button>
          <button
            className="px-3 py-1 border border-border text-white rounded text-sm disabled:opacity-50"
            onClick={handleDeviceLock}
            disabled={!deviceSupported}
          >
            Use biometrics / passkey
          </button>
          {lockConfig && (
            <button
              className="px-3 py-1 border border-border text-white rounded text-sm"
              onClick={() => {
                disableLock();
                setLockFeedback('Profile lock disabled for this session.', 'success');
              }}
            >
              Disable lock
            </button>
          )}
        </div>
        {lockMessage && (
          <p
            className={`text-xs ${
              lockMessageTone === 'success'
                ? 'text-green-400'
                : lockMessageTone === 'error'
                  ? 'text-red-400'
                  : 'text-subtext'
            }`}
          >
            {lockMessage}
          </p>
        )}
        {!deviceSupported && (
          <p className="text-xs text-amber-300">
            Passkeys/biometrics are not supported on this browser. Try Chrome, Safari, or a modern mobile browser.
          </p>
        )}
        {(showRecoveryCodes.length ? showRecoveryCodes : issuedRecoveryCodes)?.length > 0 && (
          <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
            <p className="text-xs text-white">Save these recovery codes (one-time use):</p>
            <div className="flex flex-wrap gap-2 text-sm font-mono text-white">
              {(showRecoveryCodes.length ? showRecoveryCodes : issuedRecoveryCodes).map((code) => (
                <span key={code} className="px-2 py-1 rounded bg-surface/80 border border-border">
                  {code}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-subtext">
              Codes only show once after you set a new lock. Store them in a password manager or safe place.
            </p>
          </div>
        )}
      </div>

      <BalanceSummary className="bg-surface border border-border rounded-xl p-4 wide-card" />
      <div className="prism-box p-4 mt-4 space-y-3 mx-auto wide-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">NFTs</h3>
          <span className="text-xs text-subtext">Owned cosmetics & gifts</span>
        </div>
        <p className="text-sm text-subtext">
          View every NFT you own in one place. Starter cosmetics are hidden so you only see items you&apos;ve unlocked.
        </p>
        <div className="rounded-lg border border-dashed border-border bg-surface/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-sm">Open NFT library</p>
            <p className="text-xs text-subtext">
              Browse Pool Royale, Domino Royal, and gift NFTs without the default freebies.
            </p>
          </div>
          <Link
            to="/nfts"
            className="inline-flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold"
          >
            Open
          </Link>
        </div>
      </div>
      <div className="prism-box p-4 mt-4 space-y-3 mx-auto wide-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Magazine 3D</h3>
          <span className="text-xs text-subtext">Showroom</span>
        </div>
        <p className="text-sm text-subtext">
          Explore the dedicated Magazine page with Poly Haven tables, chairs, and decor arranged by category.
        </p>
        <div className="rounded-lg border border-dashed border-border bg-surface/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium text-sm">Open Magazine</p>
            <p className="text-xs text-subtext">
              Full-screen gallery with numbered tickets and original textures applied.
            </p>
          </div>
          <Link
            to="/magazine"
            className="inline-flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold"
          >
            Open
          </Link>
        </div>
      </div>

      {profile && profile.accountId === DEV_ACCOUNT_ID && (
        <>
          <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
            <label className="block font-semibold text-center">
              Top Up Developer Account
            </label>
            <input
              type="number"
              placeholder="Amount"
              value={devTopup}
              onChange={(e) => setDevTopup(e.target.value)}
              className="border p-1 rounded w-full max-w-xs mx-auto text-black"
            />
            <button
              onClick={handleDevTopup}
              disabled={devTopupSending}
              className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background"
            >
              {devTopupSending ? 'Processing...' : 'Top Up'}
            </button>
          </div>

          <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
            <button
              onClick={() => setShowNotifyModal(true)}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background w-full"
            >
              Notify
            </button>
          </div>

          <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
            <button
              onClick={() => setShowTasksModal(true)}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background w-full"
            >
              Manage Tasks
            </button>
          </div>

          <InfluencerClaimsCard />
        </>
      )}

      {/* Wallet section */}
      <Wallet hideClaim />
      <DevNotifyModal
        open={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        notifyText={notifyText}
        setNotifyText={setNotifyText}
        notifyPhoto={notifyPhoto}
        setNotifyPhoto={setNotifyPhoto}
        notifySending={notifySending}
        onSend={handleDevNotify}
      />
      <DevTasksModal
        open={showTasksModal}
        onClose={() => setShowTasksModal(false)}
      />
      <InfoPopup
        open={showSaved}
        onClose={() => setShowSaved(false)}
        info="Profile saved"
      />
      <InfoPopup
        open={!!notifyStatus}
        onClose={() => setNotifyStatus('')}
        info={notifyStatus}
      />
      <InfoPopup
        open={!!twitterError}
        onClose={() => setTwitterError('')}
        info={twitterError}
      />
    </div>
  );
}
