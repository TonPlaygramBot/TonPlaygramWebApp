import { useEffect, useState } from 'react';
import { TELEGRAM_ID } from '../utils/telegram.js';
import { getProfile, updateProfile, linkSocial } from '../utils/api.js';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ nickname: '', photo: '', bio: '' });

  const load = async () => {
    const data = await getProfile(TELEGRAM_ID);
    setProfile(data);
    setForm({ nickname: data.nickname || '', photo: data.photo || '', bio: data.bio || '' });
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const res = await updateProfile({ telegramId: TELEGRAM_ID, ...form });
    setProfile(res);
    alert('Profile updated');
  };

  const handleLinkGoogle = () => {
    window.open('/api/profile/google', '_blank');
  };

  if (!profile) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Profile</h2>
      <div className="space-y-2">
        <input name="nickname" value={form.nickname} onChange={handleChange} placeholder="Nickname" className="w-full p-1 border" />
        <input name="photo" value={form.photo} onChange={handleChange} placeholder="Photo URL" className="w-full p-1 border" />
        <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Bio" className="w-full p-1 border" />
        <button className="px-3 py-1 bg-blue-500 text-white" onClick={handleSave}>Save</button>
      </div>
      <div>
        <button className="px-3 py-1 bg-red-500 text-white" onClick={handleLinkGoogle}>Link Google</button>
      </div>
    </div>
  );
}
