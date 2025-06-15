# TonPlaygram Bot and Web App

TonPlaygram combines a Telegram bot with a web interface built using React and Vite. The bot handles game logic and wallet operations while the web app provides a richer UI for playing chess and managing your TPC balance.

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

## Building the Ludo game

The Ludo game embedded in the web app is built separately. To generate the static files:

1. Clone the source repository:
   ```bash
   git clone https://github.com/eze4acme/Ludo-Built-With-React.git
   ```
2. Inside that project, run:
   ```bash
   npm install
   npm run build
   ```
3. Copy the contents of the generated `dist` folder into `webapp/public/games/ludo`.

The `webapp/public/games/ludo` directory is ignored in Git, so the built files won't be committed.
