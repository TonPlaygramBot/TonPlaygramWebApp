# TonPlaygram Bot and Web App

TonPlaygram combines a Telegram bot with a web interface built using React and Vite. The bot handles game logic and wallet operations while the web app provides a richer UI for playing chess and managing your TPC balance.

## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for both the bot and webapp.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set `BOT_TOKEN` for your Telegram bot and `MONGODB_URI` for the database (use `memory` for a temporary in‑memory store).

## Running

### Web Application

- Development server: `npm --prefix webapp run dev`
- Production build: `npm run build`

### Bot and API Server

Start the Express server (which also serves the compiled web app) with:

```bash
npm start
```

The server listens on the port configured in `bot/.env` (`PORT` by default is `3000`).

## Features

- **Mining** – start a 12-hour mining session that finishes automatically and awards 2000 TPC. Press the button again only after the countdown ends to begin a new session.
- **Wallet transfers** – send TPC to other users and view transaction history.
- **Tasks** – complete tasks for extra rewards and bonuses.
- **Watch content** – watch videos or streams to earn additional TPC.
- **Referrals** – invite friends and share your referral code to earn more.

Both the bot and the web app rely on the same Express API, so once the server is running you can interact with the bot in Telegram or open the web interface in a browser.
