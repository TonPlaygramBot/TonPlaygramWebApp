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

   ⚠️ Misconfiguring these will result in a blank wallet page.

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
