import { useEffect, useRef, useState } from 'react';
import {
  getProfile,
  updateProfile,
  fetchTelegramInfo,
  depositAccount,
  sendBroadcast,
  convertGifts
} from '../utils/api.js';
import { GIFTS } from '../utils/gifts.js';
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
  const [notifyStatus, setNotifyStatus] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState([]);
  const [converting, setConverting] = useState(false);

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

  const handleConvertGifts = async () => {
    if (!selectedGifts.length) return;
    setConverting(true);
    try {
      const res = await convertGifts(profile.accountId, selectedGifts);
      if (!res?.error) {
        setProfile((p) => ({ ...p, gifts: res.gifts, balance: res.balance }));
        setSelectedGifts([]);
      }
    } catch (err) {
      console.error('convert gifts failed', err);
    } finally {
      setConverting(false);
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

      <BalanceSummary className="bg-surface border border-border rounded-xl p-4 wide-card" />

      {profile && profile.accountId === DEV_ACCOUNT_ID && (
        <>
          <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
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

          <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
            <button
              onClick={() => setShowNotifyModal(true)}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background w-full"
            >
              Notify
            </button>
          </div>
        </>
      )}

      {/* Gifts card */}
      <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
        <h3 className="font-semibold text-center">Gifts</h3>
        <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
          {profile.gifts && profile.gifts.length > 0 ? (
            profile.gifts.map((g) => {
              const info = GIFTS.find((x) => x.id === g.gift) || {};
              return (
                <label key={g._id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedGifts.includes(g._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGifts([...selectedGifts, g._id]);
                      } else {
                        setSelectedGifts(selectedGifts.filter((id) => id !== g._id));
                      }
                    }}
                  />
                  <span>{info.icon}</span>
                  <span>{info.name || g.gift}</span>
                  <span className="ml-auto">{g.price} TPC</span>
                </label>
              );
            })
          ) : (
            <p className="text-center text-subtext">No gifts</p>
          )}
        </div>
        {profile.gifts && profile.gifts.length > 0 && (
          <button
            onClick={handleConvertGifts}
            disabled={converting || selectedGifts.length === 0}
            className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
          >
            {converting ? 'Converting...' : 'Convert Selected'}
          </button>
        )}
      </div>

      {/* Wallet section */}
      <Wallet />
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
    </div>
  );
}
