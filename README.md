# TonPlaygram Bot and Web App

TonPlaygram combines a Telegram bot with a web interface built using React and Vite. The bot handles game logic and wallet operations while the web app provides a richer UI for playing games and managing your TPC balance.

---

## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for both the bot and webapp.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set:
   - `BOT_TOKEN` for your Telegram bot
   - `MONGODB_URI` for the database (use `memory` for a temporary in-memory store)
   - `AIRDROP_ADMIN_TOKENS` to enable the airdrop API (comma-separated list of tokens)
4. Install the Python requirements for the dice roller:
   ```bash
   pip install -r requirements.txt
5. Copy `webapp/.env.example` to `webapp/.env`.
   Set `VITE_API_BASE_URL` to the URL where the bot API is hosted.
   Set `VITE_TONCONNECT_MANIFEST` to `${VITE_API_BASE_URL}/tonconnect-manifest.json` as an absolute URL.
   Misconfiguring these values causes the wallet page to render blank.

