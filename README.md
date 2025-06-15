---

## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for both the bot and webapp.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set:
   - `BOT_TOKEN` – your Telegram bot token
   - `MONGODB_URI` – MongoDB connection string or `memory`
   - `AIRDROP_ADMIN_TOKENS` – (optional) tokens allowed to trigger airdrops
   - `TONCONNECT_MANIFEST_URL` – public URL to your TonConnect manifest
   - `PORT` – (optional) port for the bot API server (defaults to 3000)

4. Copy `webapp/.env.example` to `webapp/.env` and configure:
   - `VITE_API_BASE_URL` – the base URL where the bot API is hosted (e.g. `http://localhost:3000`)
   - `VITE_TONCONNECT_MANIFEST` – must be `${VITE_API_BASE_URL}/tonconnect-manifest.json` (absolute URL)

  ⚠️ Misconfiguring these may prevent the wallet from loading correctly.
  If the wallet page appears blank, ensure these variables are set. A working
  configuration is included in `webapp/.env` which points to the live demo API.

5. Install the Python requirements for the dice roller:

   ```bash
   pip install -r requirements.txt
   ```

6. Build the webapp assets:

   ```bash
   npm --prefix webapp run build
   ```

7. Run the test suite to verify the setup:

   ```bash
   npm test
   ```

## Telegram game bots

Several small Telegram game bots are included in this repository. They use
`python-telegram-bot` and Pillow to render board graphics. To try them out run:

```bash
pip install -r requirements.txt

# Set BOT_TOKEN for your own Telegram bot token
export BOT_TOKEN=<your token>

# Launch the Mars grid roller game
python mars_grid_roller.py

# Launch the TonPlaygram dice roller clone
python tonplaygram_grid_roller.py

# Launch the Ludo prototype
python tonplaygram_ludo.py
```

Each script will start a bot that responds to commands such as `/roll` or `/start`.

### Installing Ludo web assets

The `scripts/install_ludo_game.sh` helper fetches and builds an external React
implementation of Ludo used by the webapp. It requires `git` and `npm`:

```bash
bash scripts/install_ludo_game.sh
```

The compiled assets are copied into `webapp/public/games/ludo`.
