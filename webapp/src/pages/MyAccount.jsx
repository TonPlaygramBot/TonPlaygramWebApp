import { useEffect, useRef, useState } from 'react';
import { getProfile, updateProfile, fetchTelegramInfo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
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
  const [wasUpdatedFromTelegram, setWasUpdatedFromTelegram] = useState(false);
  const timerRef = useRef(null);

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
              photo: data.photo || tg.photoUrl,
              firstName: data.firstName || tg.firstName,
              lastName: data.lastName || tg.lastName
            });
            setProfile(updated);
            setWasUpdatedFromTelegram(true);
            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => setWasUpdatedFromTelegram(false), 4000);
          }
        } finally {
          setAutoUpdating(false);
        }
      }
    }
    load();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [telegramId]);

  if (!profile) return <div className="p-4 text-subtext">Loading...</div>;

  return (
    <div className="p-4 space-y-4 text-text">
      {autoUpdating && (
        <div className="p-2 text-sm text-subtext">Updating with Telegram info...</div>
      )}
      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-bold">My Account</h2>
        {wasUpdatedFromTelegram && (
          <span className="text-sm text-accent">Info retrieved from Telegram.</span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        {profile.photo && (
          <img src={profile.photo} alt="avatar" className="w-16 h-16 rounded-full" />
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
