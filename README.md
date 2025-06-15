# TonPlaygram Bot and Web App

TonPlaygram combines a Telegram bot with a web interface built using React and Vite. The bot handles game logic and wallet operations while the web app provides a richer UI for playing chess and managing your TPC balance.

---

## Installation

1. Install **Node.js 18** or later.

2. Run `npm run install-all` at the repository root to install dependencies for both the bot and webapp.

3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set:

   - `BOT_TOKEN` for your Telegram bot

   - `MONGODB_URI` for the database (use `memory` for a temporary in‑memory store)

   - `AIRDROP_ADMIN_TOKENS` to enable the airdrop API (comma-separated list of tokens)

---

## Running

### Web Application

- Development server:  

  ```bash

  npm --prefix webapp run dev
### Admin API

- `POST /api/airdrop/grant-all` — grant an airdrop to all users (requires bearer token from `AIRDROP_ADMIN_TOKENS`)

