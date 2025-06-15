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
```

5. Start the development server:
   ```bash
   npm start
   ```

The bot reads configuration from `bot/.env`.
Set at least the following variables:

* `BOT_TOKEN` - Telegram bot token
* `MONGODB_URI` - MongoDB connection string or `memory`
* `PORT` - port for the API server (defaults to `3000`)
* `AIRDROP_ADMIN_TOKENS` - (optional) tokens allowed to trigger airdrops
* `TONCONNECT_MANIFEST_URL` - URL of the TonConnect manifest

Once running, open [http://localhost:3000](http://localhost:3000)
 to access the web interface.

