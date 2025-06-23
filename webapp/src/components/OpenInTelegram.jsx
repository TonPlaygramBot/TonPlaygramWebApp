import React from 'react';

import { RiTelegramFill } from 'react-icons/ri';
import { BOT_USERNAME } from '../utils/constants.js';

const TG_LINK = `https://t.me/${BOT_USERNAME}`;

export default function OpenInTelegram() {

  return (

    <div className="p-4 text-text">

      <p>
        This page only works from within Telegram. If you see a blank wallet
        screen, open the WebApp using the bot link below.
      </p>

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