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

5. Run `./scripts/install_ludo_game.sh` to download the Ludo game assets. The script
   clones the [Ludo-Built-With-React](https://github.com/eze4acme/Ludo-Built-With-React)
   project, builds it and copies the result to `webapp/public/games/ludo/`.
