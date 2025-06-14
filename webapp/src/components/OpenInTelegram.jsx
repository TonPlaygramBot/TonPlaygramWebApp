import React from 'react';

const BOT_USERNAME = 'TonPlaygramBot';
const TG_LINK = `https://t.me/${BOT_USERNAME}`;

export default function OpenInTelegram() {
  return (
    <div className="p-4 text-text">
      <p>Please open this application via the Telegram bot.</p>
      <a
        href={TG_LINK}
        className="mt-2 inline-block px-3 py-1 bg-primary hover:bg-primary-hover text-text rounded"
      >
        Open in Telegram
      </a>
    </div>
  );
}
