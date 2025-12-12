import { useEffect, useRef, useState } from 'react';
import {
  getAccountInfo,
  createAccount,
  updateProfile,
  fetchTelegramInfo,
  depositAccount,
  sendBroadcast,
  linkSocial,
  getUnreadCount
} from '../utils/api.js';
import {
  getTelegramId,
  getTelegramFirstName,
  getTelegramLastName,
  getTelegramPhotoUrl
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
import LinkTelegramButton from '../components/LinkTelegramButton.jsx';

import { FiCopy } from 'react-icons/fi';

function formatValue(value, decimals = 2) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export default function MyAccount() {
  const [telegramId, setTelegramId] = useState(() => {
    try {
      return getTelegramId();
    } catch (err) {
      console.error('Failed to read Telegram ID', err);
      return null;
    }
  });
  const [googleId, setGoogleId] = useState(() => localStorage.getItem('googleId'));

  if (!telegramId && !googleId) return <LoginOptions />;

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
  const [googleLinked, setGoogleLinked] = useState(!!googleId);

  useEffect(() => {
    setGoogleLinked(!!googleId);
  }, [googleId]);

  useEffect(() => {
    if (!telegramId && !googleId) return undefined;

    async function load() {
      const acc = await createAccount(telegramId, googleId);
      if (acc?.error) {
        console.error('Failed to load account:', acc.error);
        return;
      }
      if (acc.accountId) {
        localStorage.setItem('accountId', acc.accountId);
      }
      if (acc.walletAddress) {
        localStorage.setItem('walletAddress', acc.walletAddress);
      }

      const data = await getAccountInfo(acc.accountId);
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
      setTwitterLink(finalProfile.social?.twitter || '');
      const defaultPhoto = telegramId ? getTelegramPhotoUrl() : '';
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

    load();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telegramId, googleId]);

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

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  const photoToShow = photoUrl || getTelegramPhotoUrl();

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

  return (
    <div className="relative p-4 space-y-4 text-text wide-card">
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
                onLinked={(linkedId) => {
                  setGoogleLinked(true);
                  if (linkedId) setGoogleId(linkedId);
                }}
              />
            </div>
          )}
          {!telegramId && googleId && (
            <div className="mt-2">
              <p className="text-sm mb-1 text-white-shadow">
                Link your Telegram account:
              </p>
              <LinkTelegramButton
                googleId={googleId}
                onLinked={(linkedId) => {
                  setTelegramId(linkedId);
                  setProfile((p) => (p ? { ...p, telegramId: linkedId } : p));
                }}
              />
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

      <BalanceSummary className="bg-surface border border-border rounded-xl p-4 wide-card" />
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
