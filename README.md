# TonPlaygram Bot and Web App

TonPlaygram combines a Telegram bot with a web interface built using React and Vite. The bot handles game logic and wallet operations while the web app provides a richer UI for playing chess and managing your TPC balance.

## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for both the bot and webapp.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set `BOT_TOKEN` for your Telegram bot and `MONGODB_URI` for the database (use `memory` for a temporary in‑memory store). To enable the airdrop API also set `AIRDROP_ADMIN_TOKENS` with one or more bearer tokens.

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

### Available Games

- Chess with staking
- Connect Four with staking
- Spin & Win mini game
- Dice Duel (PvP)

### Airdrops

Admins can grant in-app token airdrops through the `/api/airdrop/grant` endpoint.
Set `AIRDROP_ADMIN_TOKENS` in `bot/.env` to a comma separated list of bearer
tokens that are allowed to perform airdrops. Include the chosen token in the
`Authorization` header when calling the API.

Example request using `curl`:

```bash
curl -X POST \ 
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"telegramId":12345,"amount":10,"reason":"promo"}' \
     http://localhost:3000/api/airdrop/grant
```

A helper function `grantAirdrop` is available in `webapp/src/utils/api.js` for
frontend or admin tooling.
