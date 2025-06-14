import React from 'react';
import { RiTelegramFill } from 'react-icons/ri';

const BOT_USERNAME = 'TonPlaygramBot';
const TG_LINK = `https://t.me/${BOT_USERNAME}`;

export default function OpenInTelegram() {
  return (
    <div className="p-4 text-text">
      <p>Please open this application via the Telegram bot.</p>
      <a
        href={TG_LINK}
        className="mt-2 inline-flex items-center space-x-1 px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
      >
        <RiTelegramFill className="w-4 h-4" />
        <span>Open in Telegram</span>
      </a>
    </div>
  );
}
