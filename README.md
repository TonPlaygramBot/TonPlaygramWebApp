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

### The Wall

Users can share photos and messages on **The Wall**. Posts support likes, comments and sharing. You can also attach images up to about 10&nbsp;MB and repost to Telegram, Twitter or Facebook. Friends see your updates and receive Telegram notifications when they interact with them.

The latest update adds avatars, stylish icon buttons and a simple alerts panel right on **The Wall**. Posts now show the author's profile picture and name for a more social look. Buttons for liking, commenting and sharing use crisp icons that suit the premium color scheme. The bell icon scrolls to the **Alerts** section which reminds users that real notifications arrive via Telegram.

Images in posts now include optional **alt text** descriptions for better accessibility. When creating a post you can add a brief description so screen readers can convey the image content.

Posts support **markdown formatting** and emoji **reactions**. Owners can pin favourite posts so they stay at the top. Each post tracks how many times it has been viewed.

The Wall also features a **Trending** section showing the most liked posts from the last 24 hours.

### Using an HTTPS proxy

If your server requires a proxy to reach external services like Tonkeeper,
set the `HTTPS_PROXY` (or `https_proxy`) environment variable before running the
bot. All fetch requests from the Node.js backend will be routed through this
proxy.

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

### Customizing Snakes & Ladders icons

All webapp icons are stored in `webapp/public/assets/icons`. The board now uses `snake.png` and `ladder.png` for snake and ladder connectors. Replace these files or add new ones in the same folder and update the paths in `src/index.css` if you want custom graphics.
