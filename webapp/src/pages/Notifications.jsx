import NotificationBell from '../components/NotificationBell.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId } from '../utils/telegram.js';

export default function Notifications() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  // Notifications are delivered via Telegram bot messages
  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold flex items-center space-x-2">
        <NotificationBell />
        <span>Notifications</span>
      </h2>
      <p>Your interactions are sent to you directly via Telegram.</p>
    </div>
  );
}
