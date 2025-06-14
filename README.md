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

### TonConnect manifest

Tonkeeper and other wallets load the manifest from the URL specified in
`VITE_TONCONNECT_MANIFEST` during the web app build. When the frontend is
hosted on a different domain than the API, set this variable to the absolute
URL of your backend, e.g. `https://your-api.example.com/tonconnect-manifest.json`.
Otherwise the wallet may receive a **404 Not Found** when trying to fetch the
manifest.
