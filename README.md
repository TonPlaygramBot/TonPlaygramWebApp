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

---

## Running

### Web Application

- Development server:

  ```bash
  npm --prefix webapp run dev
  ```

### Bot

- Start the bot:

  ```bash
  npm start
  ```

### Dice Roller Bot

- Launch the TonPlaygram Roller (requires `BOT_TOKEN`):

```bash
BOT_TOKEN=your_token python3 tonplaygram_grid_roller.py
```

The Ludo game is now playable directly in the web app at `/games/ludo`.

### Database Configuration

Set `MONGODB_URI` in `bot/.env` to your MongoDB connection string. For a local MongoDB instance, you might use:

```env
MONGODB_URI=mongodb://localhost:27017/tonplaygram
```

If `MONGODB_URI` is set to `memory`, the server launches an in-memory MongoDB for testing only.

---

## Troubleshooting

Common issues when connecting via TonConnect:

| Issue | Solution |
|-------|---------|
| ✅ **TonConnect not initialized** | Make sure TonConnect is initialized with your manifest URL. |
| ❌ **Wallet not listed (Tonkeeper/TonSpace)** | Your manifest must be public and valid JSON hosted online. |
| 🚫 **Wrong bridge settings** | Use the official TonConnect bridge https://bridge.tonapi.io/bridge |
| ⚠️ **Wallet not responding** | Check if the web app is served over HTTPS and opened in a compatible browser. |
| 🔒 **Wallet connection fails silently** | Make sure Tonkeeper/Ton Space is installed and allowed for dApp connections. |
