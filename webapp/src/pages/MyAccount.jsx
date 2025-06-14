import { useEffect, useRef, useState } from 'react';
import { getProfile, updateProfile, fetchTelegramInfo } from '../utils/api.js';
import {
  getTelegramId,
  getTelegramFirstName,
  getTelegramLastName,
  getTelegramPhotoUrl
} from '../utils/telegram.js';
import OpenInTelegram from '../components/OpenInTelegram.jsx';

export default function MyAccount() {
  let telegramId;

  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [profile, setProfile] = useState(null);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    async function load() {
      const data = await getProfile(telegramId);
      setProfile(data);

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

          const mergedProfile = {
            ...updated,
            photo: updated.photo || tg?.photoUrl || getTelegramPhotoUrl()
          };

          setProfile(mergedProfile);
        } finally {
          setAutoUpdating(false);
        }
      }
    }

    load();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [telegramId]);

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  const photoUrl = profile.photo || getTelegramPhotoUrl();

  return (
    <div className="p-4 space-y-4 text-text">
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}

      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-bold">My Account</h2>
      </div>

      <div className="flex items-center space-x-4">
        {photoUrl && (
          <img
            src={photoUrl}
            alt="avatar"
            className="w-16 h-16 object-cover hexagon hexagon-gold"
          />
        )}
        <div>
          <p className="font-semibold">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-subtext">ID: {profile.telegramId}</p>
        </div>
      </div>
    </div>
  );
}
