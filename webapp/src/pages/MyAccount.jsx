import { useEffect, useState } from 'react';
import { getProfile, updateProfile, fetchTelegramInfo } from '../utils/api.js';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
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

  useEffect(() => {
    async function load() {
      const data = await getProfile(telegramId);
      setProfile(data);
      if (!data.photo || !data.firstName || !data.lastName) {
        setAutoUpdating(true);
        try {
          const tg = await fetchTelegramInfo(telegramId);
          if (tg && !tg.error) {
            const updated = await updateProfile({
              telegramId,
              photo: data.photo || tg.photoUrl || getTelegramPhotoUrl(),
              firstName: data.firstName || tg.firstName,
              lastName: data.lastName || tg.lastName
            });
            const withPhoto = {
              ...updated,
              photo: updated.photo || tg.photoUrl || getTelegramPhotoUrl()
            };
            setProfile(withPhoto);
          }
        } finally {
          setAutoUpdating(false);
        }
      }
    }
    load();
  }, [telegramId]);

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  const photoUrl = profile.photo || getTelegramPhotoUrl();

  return (
    <div className="p-4 space-y-4 text-text">
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}
      <h2 className="text-xl font-bold">My Account</h2>
      <div className="flex items-center space-x-4">
        {photoUrl && (
          <img src={photoUrl} alt="avatar" className="w-16 h-16 rounded-full" />
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
