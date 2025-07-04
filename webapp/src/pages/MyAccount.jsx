import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  updateProfile,
  fetchTelegramInfo,
  depositAccount,
  sendBroadcast
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
import InboxWidget from '../components/InboxWidget.jsx';
import Wallet from './Wallet.jsx';

import { FiCopy } from 'react-icons/fi';

function formatValue(value, decimals = 2) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function MyAccount() {
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [profile, setProfile] = useState(null);
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

  useEffect(() => {
    async function load() {
      const data = await getProfile(telegramId);
      let finalProfile = data;

      if (!data.photo || !data.firstName || !data.lastName) {
        setAutoUpdating(true);

        try {
          let tg;
          try {
            tg = await fetchTelegramInfo(telegramId);
          } catch (err) {
            console.error('fetchTelegramInfo failed', err);
          }

          const firstName = data.firstName || tg?.firstName || getTelegramFirstName();
          const lastName = data.lastName || tg?.lastName || getTelegramLastName();
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
            ...updated,
            photo: hasRealPhoto || getTelegramPhotoUrl()
          };

          finalProfile = mergedProfile;
        } finally {
          setAutoUpdating(false);
        }
      }

      setProfile(finalProfile);
      if (!localStorage.getItem('avatarPromptShown')) {
        setShowAvatarPrompt(true);
      }
    }

    load();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telegramId]);

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  const photoUrl = loadAvatar() || profile.photo || getTelegramPhotoUrl();


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
      if (!res?.error) {
        // notification sent
      }
    } catch (err) {
      console.error('notify failed', err);
    } finally {
      setNotifyText('');
      setNotifyPhoto('');
      setNotifySending(false);
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text">
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
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}

      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-bold">My Account</h2>
      </div>

      <div className="flex items-center space-x-4">
        {photoUrl && (
          <img src={getAvatarUrl(photoUrl)} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
        )}
        <div>
          <p className="font-semibold">
            {profile.firstName} {profile.lastName}
          </p>
          <div className="text-sm text-subtext flex items-center space-x-1">
            <span>Account: {profile.accountId}</span>
            <FiCopy
              className="w-4 h-4 cursor-pointer"
              onClick={() => navigator.clipboard.writeText(String(profile.accountId))}
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
          <div className="mt-2 space-x-2">
            <a href="/friends" className="underline text-primary">
              Friends
            </a>
            <a href="/messages" className="underline text-primary">
              Inbox
            </a>
          </div>
        </div>
      </div>

      <BalanceSummary />

      {profile && profile.accountId === DEV_ACCOUNT_ID && (
        <>
          <div className="prism-box p-4 mt-4 space-y-2 w-80 mx-auto border-[#334155]">
            <label className="block font-semibold text-center">Top Up Developer Account</label>
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

          <div className="prism-box p-4 mt-4 space-y-2 w-80 mx-auto border-[#334155]">
            <label className="block font-semibold text-center">Send Notification</label>
            <textarea
              placeholder="Message"
              value={notifyText}
              onChange={(e) => setNotifyText(e.target.value)}
              className="border p-1 rounded w-full aspect-square text-black"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setNotifyPhoto(reader.result);
                reader.readAsDataURL(file);
              }}
              className="border p-1 rounded w-full max-w-xs mx-auto text-black"
            />
            {notifyPhoto && (
              <img src={notifyPhoto} alt="preview" className="max-h-40 mx-auto" />
            )}
            <button
              onClick={handleDevNotify}
              disabled={notifySending}
              className="mt-1 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background"
            >
              {notifySending ? 'Sending...' : 'Notify'}
            </button>
          </div>
        </>
      )}

      {/* Wallet section */}
      <Wallet />
      <InboxWidget />
      <InfoPopup
        open={showSaved}
        onClose={() => setShowSaved(false)}
        info="Profile saved"
      />
    </div>
  );
}
