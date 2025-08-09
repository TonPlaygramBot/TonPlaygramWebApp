import { useEffect, useState } from 'react';
import LoginOptions from './LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';

export default function RequireAuth({ children }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let has = false;
    try { has = !!getTelegramId(); } catch {}
    if (!has) has = !!localStorage.getItem('googleId');
    setOk(has);
  }, []);
  return ok ? children : <LoginOptions />;
}
