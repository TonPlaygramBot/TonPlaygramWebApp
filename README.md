
## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for the bot, webapp and test suite.
   You can also execute `./scripts/setup-tests.sh` when preparing a clean test environment.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set:
   - `BOT_TOKEN` – your Telegram bot token
   - `MONGODB_URI` – MongoDB connection string or `memory`
     (falls back to an in-memory database if unset)
   - `AIRDROP_ADMIN_TOKENS` – (optional) tokens allowed to trigger airdrops
   - `DEPOSIT_WALLET_ADDRESS` – TON address that receives user deposits
   - `PORT` – (optional) port for the bot API server (defaults to 3000)
   - `DEV_ACCOUNT_ID` – account ID that collects transfer fees
   - `DEV_ACCOUNT_ID_1` – (optional) secondary developer account (1% share)
   - `DEV_ACCOUNT_ID_2` – (optional) secondary developer account (2% share)
   - `API_AUTH_TOKEN` – (optional) token for trusted server-to-server calls
   - `TWITTER_BEARER_TOKEN` – bearer token for verifying retweets. Make sure this line is uncommented in `bot/.env`.
   - `TWITTER_CLIENT_ID` – API key for Twitter OAuth linking.
   - `TWITTER_CLIENT_SECRET` – API secret for Twitter OAuth linking.
   - You can also place these Twitter credentials in `twitter.env` at the repository root.

4. Copy `webapp/.env.example` to `webapp/.env` and configure:
   - `VITE_API_BASE_URL` – the base URL where the bot API is hosted (e.g. `http://localhost:3000`).
     If omitted, the webapp will connect to the same origin it was served from.
   - `VITE_GOOGLE_CLIENT_ID` – OAuth client ID for Google sign-in.
   - `VITE_DEV_ACCOUNT_ID` – account ID that receives the 9% developer share.
   - `VITE_DEV_ACCOUNT_ID_1` – (optional) account that receives a 1% share.
  - `VITE_DEV_ACCOUNT_ID_2` – (optional) account that receives a 2% share.
  - `VITE_API_AUTH_TOKEN` – (optional) token used when calling privileged API
    endpoints outside Telegram.

   This value is required for the Google button to appear on the login and
   profile pages. When provided, the webapp lets users sign in with Google and
   stores their Google ID alongside any Telegram information when calling

The main developer wallet belongs to **Tur.Alimadhi** and has account ID
`5ffe7c43-c0ae-48f6-ab8c-9e065ca95466`. All developer earnings are deposited to
this account.
   `/api/profile/register-google`.

⚠️ Misconfiguring these may prevent the wallet from loading correctly.

All `.env` files and `twitter.env` are excluded from version control via `.gitignore` so your credentials remain private.
Check `.gitignore` at the repository root if you need a reminder of which files are ignored:

```
twitter.env
.env*
**/.env*
```
Files like `bot/.env`, `webapp/.env` and `scripts/.env` match these patterns.

The server honors a few extra environment variables when building or serving the webapp:

- `WEBAPP_API_BASE_URL` – overrides the API base used during the webapp build. Set this when the bot API is hosted on another domain or port. If left empty the webapp assumes it is served from the same origin.
 - `TONCONNECT_MANIFEST_URL` – full URL for a custom `tonconnect-manifest.json`. Defaults to the manifest bundled with the build when unset.
 - `SKIP_WEBAPP_BUILD` – set to any value to skip the automatic webapp build that normally runs when `npm start` is executed. Useful if you built the assets manually.

5. Copy `scripts/.env.example` to `scripts/.env` and set:
   - `MNEMONIC` – wallet seed phrase used to deploy the Jetton
   - `RPC_URL` – TON RPC endpoint (e.g. testnet)
   - `ADMIN_ADDRESS` – address that receives the minted supply

6. Build the webapp assets. This step copies `public/tonconnect-manifest.json`
   into the `dist` folder so wallets can connect:

   ```bash
   npm --prefix webapp run build
   ```

7. Run the test suite to verify the setup. Ensure all packages are installed
   first by executing `npm run install-all` (or `npm install` in each package)
   so dependencies like `express` and `socket.io-client` are available:

   ```bash
   npm test
   ```

8. Start the API server and Telegram bot:

   ```bash
   npm start
   ```

### Local development

Run both the API server and the webapp together while developing:

```bash
npm run dev
```

This command launches the backend and the Vite dev server simultaneously so you
can test changes right away.

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


### Wallet overview

This app exposes a single **TPC Wallet** stored in MongoDB. Commands like
`/wallet balance` and `/wallet send` interact with this database record. TON
deposits sent to `DEPOSIT_WALLET_ADDRESS` credit the balance after the transfer
is detected.

### Depositing via API

Call `POST /api/account/deposit` to credit TPC to any account. Normally the
request must include Telegram web app data in the `X-Telegram-Init-Data` header
so the server can verify the user. When the `API_AUTH_TOKEN` environment
variable is set, you may instead supply `Authorization: Bearer <token>` to
bypass Telegram checks. This is useful for server‑side actions such as
awarding the developer share after a game ends.

### Common issues

- **Balance always zero** – verify MongoDB is running and `MONGODB_URI` points
  to a running database instance. The backend must be able to connect.
- **In-memory database fails to launch** – the app will start without MongoDB if
  the `mongodb-memory-server` download fails.
- **No Telegram notifications** – confirm `npm start` is running and the bot
  token is valid. The invite endpoints now attempt to resolve the recipient via
  account ID or Telegram ID. The recipient must have interacted with the bot in
  Telegram for notifications to succeed. If delivery fails the invite API still
  returns a URL that can be shared with the recipient.
- **Cannot send TPC** – this happens when the API cannot verify your Telegram
  web app data. Ensure the web page was opened from your bot and that the
  `BOT_TOKEN` in `bot/.env` matches the token used by Telegram.

### Resetting the TPC wallet

Use these options if you need to completely start over:

1. Open the wallet page in the webapp.
2. Click **Reset TPC Wallet** to erase your off-chain balance and transaction
   history stored in MongoDB. Your TPC balance will be set to zero.

After resetting you can reconnect and deposit again as if it were a new account.

### Broadcasting messages

An admin can send a text message to every registered Telegram user.

```
POST /api/broadcast/send
Authorization: Bearer <admin token>
{ "text": "hello users" }
```

The request body must include a `text` field. Only tokens listed in
`AIRDROP_ADMIN_TOKENS` are allowed to call this endpoint.


### Customizing Snakes & Ladders icons

All webapp icons are stored under `webapp/public`. The board uses emoji symbols
(🐍, 🪜 and 🎲) for snake, ladder and dice connectors instead of the old SVG
files.

Token icons for the lobby and wallet are now stored as WebP files:

- `assets/icons/TON.webp`
- `assets/icons/Usdt.webp`
- `assets/icons/TPCcoin_1.webp`

Place your own images with those exact names in the same directories to
override them.

### Snake & Ladder engine notes

Active games live in memory via `GameRoom` objects in `bot/gameEngine.js`. Each
player tracks whether their socket has disconnected and the timestamp of their
most recent roll.

Turns skip over disconnected players:

```js
while (this.players[this.currentTurn].disconnected) {
  this.currentTurn = (this.currentTurn + 1) % this.players.length;
}
```

When a player disconnects during their turn the room immediately advances
to the next active player so the game never stalls.

Rooms are deleted once everyone disconnects. There is no automatic reconnect
timeout, but a player can reload the webapp to restore state from `localStorage`
and continue if the room still exists.

Rolls are subject to a cooldown to prevent spamming. A request is ignored when
it occurs before `ROLL_COOLDOWN_MS` has elapsed:

```js
if (Date.now() - player.lastRollTime < this.rollCooldown) return;
```

Players have 15 seconds to roll on their turn. When the countdown hits zero
the server automatically rolls for them so the game keeps moving.

### Playing against the AI

Opening the Snake & Ladder game without specifying an `ai` parameter now
defaults to one computer opponent. You can set `?ai=1`, `?ai=2` or `?ai=3` in
the URL – or pick the number in the lobby – to change how many AI players join.

### Multiplayer status

Online multiplayer has arrived. Join a table in the lobby to create or enter that room. Wait for other players to join you. Once everyone is ready the match starts and you all move on the same board in real time.

### Entering the Snake & Ladder game

To move from the start you must roll at least one six when rolling two dice. Any combination containing a six lets you enter the board, including:

- 6 + 1
- 6 + 2
- 6 + 3
- 6 + 4
- 6 + 5
- 6 + 6
- 1 + 6
- 2 + 6
- 3 + 6
- 4 + 6
- 5 + 6

### Game Rules

- **Getting started** – You cannot move from the start until one of your dice shows a six. Any combination with a six moves you onto tile 1.
- **Movement and cells** – Move forward by the sum of both dice. Ladders lift you up, snakes drop you down and landing on a bonus dice cell awards another roll.
- **Capturing** – Finish your move on a tile already occupied by another player to send that token back to start.
- **Winning and extra turns** – You must land exactly on the final pot tile. From tile 100 you need to roll a single one. Rolling double six gives an extra turn.
- **In‑app help** – A help button in game opens an info popup implemented in [`SnakeAndLadder.jsx`](webapp/src/pages/Games/SnakeAndLadder.jsx).

## Troubleshooting

**Twitter API not configured** – When no `TWITTER_BEARER_TOKEN` is provided the server now skips verification for X related tasks and completes them automatically. Add the token in `bot/.env` if you need strict checks.

**Influencer admin shows "No submissions"** – Ensure your developer token is set in `bot/.env` via `AIRDROP_ADMIN_TOKENS` and in `webapp/.env` through `VITE_API_AUTH_TOKEN` so the webapp can fetch pending submissions.

**Telegram reaction not detected** – The `/api/tasks/verify-telegram-reaction` endpoint relies on `BOT_TOKEN`. If this token is missing the check is skipped and the task automatically succeeds. Configure it only if you require strict validation.


## License

This project is licensed under the [MIT License](LICENSE).

