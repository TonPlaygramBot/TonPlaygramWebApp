


### Game design notes

- [Texas Hold'em game flow](docs/texas-holdem-game.md) – drejtimi clockwise i butonit/dealer-it dhe hapat bazë të një dueli duke përdorur logjikën në `lib/texasHoldem.js`.

## Installation

1. Install **Node.js 18** or later.
2. Run `npm run install-all` at the repository root to install dependencies for the bot, webapp and test suite. After the packages finish installing, run `./scripts/setup-tests.sh` once to install OS libraries required by native modules such as `canvas`. Without them `npm test` will fail.
3. Copy `bot/.env.example` to `bot/.env` and update the values. At minimum set:
   - `BOT_TOKEN` – your Telegram bot token
   - `MONGO_URI` – MongoDB connection string. If left empty in development it
     falls back to an in-memory database, but you must provide a real URI in
     production.
   - `AIRDROP_ADMIN_TOKENS` – (optional) tokens allowed to trigger airdrops
  - `DEPOSIT_WALLET_ADDRESS` – TON address that receives user deposits
  - `STORE_DEPOSIT_ADDRESS` – TON address that receives payments for store bundles
  - `CLAIM_CONTRACT_ADDRESS` – address of the deployed `tpc_claim_wallet` contract
  - `CLAIM_WALLET_MNEMONIC` – seed phrase used to sign claim transactions
  - `TPC_JETTON_ADDRESS` – token contract address shown after a claim
  - `RPC_URL` – (optional) TON RPC endpoint for claim messages. Defaults to `https://toncenter.com/api/v2/jsonRPC`
   - `PORT` – (optional) port for the bot API server (defaults to 3000)
- `DEV_ACCOUNT_ID` – account ID that collects transfer fees

  - `DEV_ACCOUNT_ID_1` – (optional) secondary developer account (1% share)

  - `DEV_ACCOUNT_ID_2` – (optional) secondary developer account (2% share)

  - `API_AUTH_TOKEN` – (optional) token for trusted server-to-server calls

  - `RATE_LIMIT_WINDOW_MS` – (optional) timeframe for rate limits in milliseconds (defaults to 900000)

  - `RATE_LIMIT_MAX` – (optional) max requests per window from one IP (defaults to 100)

 - `ALLOWED_ORIGINS` – list of origins allowed for CORS and socket.io. Multiple
    origins may be comma-separated, e.g.
    `https://tonplaygram-bot.onrender.com,https://t.me,https://web.telegram.org`
  - `GOOGLE_CLIENT_ID` – (optional) Google OAuth client ID used to serve the
    profile/login Google button when the webapp was built without
    `VITE_GOOGLE_CLIENT_ID`.

  - `TWITTER_BEARER_TOKEN` – bearer token for verifying reposts on **X**.
  - `TWITTER_CLIENT_ID` – API key for **X** OAuth linking.
  - `TWITTER_CLIENT_SECRET` – API secret for **X** OAuth linking.
  - `WITHDRAW_ENABLED` – set to `true` to allow user withdrawals

    When deploying on **Render**, set these values (including `CLAIM_CONTRACT_ADDRESS`, `CLAIM_WALLET_MNEMONIC` and `RPC_URL`) in the service environment instead of storing them in `.env` files.

4. Copy `webapp/.env.example` to `webapp/.env` and configure:
   - `VITE_API_BASE_URL` – the base URL where the bot API is hosted (e.g.
     `https://tonplaygram-bot.onrender.com`). If omitted, the webapp will
     connect to the same origin it was served from.
   - `VITE_GOOGLE_CLIENT_ID` – OAuth client ID for Google sign-in.
  - `VITE_DEV_ACCOUNT_ID` – account ID that receives the developer share
    (10% by default).
  - `VITE_DEV_ACCOUNT_ID_1` – (optional) secondary developer account. When set,
    the main account receives 9% and this account receives 1%.
  - `VITE_DEV_ACCOUNT_ID_2` – (optional) additional developer account. When set,
    the main account receives 9% and this account receives 2%.
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

All `.env` files are excluded from version control via `.gitignore` so your credentials remain private.
Check `.gitignore` at the repository root if you need a reminder of which files are ignored:

```
.env*
**/.env*
```
Files like `bot/.env`, `webapp/.env` and `scripts/.env` match these patterns.

When deploying on **Render**, provide the same keys using the service's
**Environment** settings or an environment group. Be sure to include
`CLAIM_CONTRACT_ADDRESS`, `CLAIM_WALLET_MNEMONIC` and `RPC_URL`. The backend
loads values from the runtime environment automatically so you can keep the
`.env` files only for local development.

The server honors a few extra environment variables when building or serving the webapp:

- `WEBAPP_API_BASE_URL` – overrides the API base used during the webapp build. Set this when the bot API is hosted on another domain or port. If left empty the webapp assumes it is served from the same origin.
- `SKIP_WEBAPP_BUILD` – set to any value to skip the automatic webapp build that normally runs when `npm start` is executed. Useful if you built the assets manually.
- `ALLOWED_ORIGINS` – list of origins allowed for CORS and socket.io when serving the API. Separate multiple origins with commas.

5. Copy `scripts/.env.example` to `scripts/.env` and set:
   - `MNEMONIC` – wallet seed phrase used to deploy the Jetton
   - `RPC_URL` – TON RPC endpoint (e.g. testnet)
   - `ADMIN_ADDRESS` – address that receives the minted supply

6. **(Optional)** Build the webapp assets. Running `npm start` will
   automatically build the webapp if `webapp/dist` is missing:

   ```bash
   npm --prefix webapp run build
   ```

### Preparing the test environment

Use `scripts/setup-tests.sh` to set up a fresh machine for the test suite.
Native modules such as `canvas` require additional OS packages before they can
compile correctly. Install them with apt before running
`scripts/setup-tests.sh` or executing `npm test` directly:

```bash
sudo apt-get install -y \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  build-essential \
  pkg-config
```

Without these libraries the `canvas` module cannot compile and `npm test` will
fail. The setup script installs them automatically and then runs
`npm run install-all` to install all Node.js dependencies. Run it once before
executing the tests or when installing the project on a new system.

The tests require minimal configuration via environment variables. Copy
`bot/.env.example` to `bot/.env` and set at least:

- `BOT_TOKEN` – any string is sufficient for testing
- `MONGO_URI` – MongoDB connection string (or `memory` to use the in-memory database)

With these variables in place you can run the test suite with:

```bash
npm test
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

Users can share photos and messages on **The Wall**. Posts support likes, comments and sharing. You can also attach images up to about 10&nbsp;MB and repost to Telegram, **X** or Facebook. Friends see your updates and receive Telegram notifications when they interact with them.

The latest update adds avatars, stylish icon buttons and a simple alerts panel right on **The Wall**. Posts now show the author's profile picture and name for a more social look. Buttons for liking, commenting and sharing use crisp icons that suit the premium color scheme. The bell icon scrolls to the **Alerts** section which reminds users that real notifications arrive via Telegram.

Images in posts now include optional **alt text** descriptions for better accessibility. When creating a post you can add a brief description so screen readers can convey the image content.

Posts support **markdown formatting** and emoji **reactions**. Owners can pin favourite posts so they stay at the top. Each post tracks how many times it has been viewed.

The Wall also features a **Trending** section showing the most liked posts from the last 24 hours.

### Free Kick goal sound

The **Free Kick** game uses the `webapp/public/assets/sounds/a-football-hits-the-net-goal-313216-[AudioTrimmer.com].mp3` clip when a shot scores. Only the second half of the audio (~0.5 s) is played so players hear just the net impact.

### Using an HTTPS proxy

If your server requires a proxy to reach external services like Tonkeeper,
set the `HTTPS_PROXY`/`https_proxy` or `HTTP_PROXY`/`http_proxy` environment
variable before running the bot. All fetch requests from the Node.js backend
will be routed through this proxy.


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

### Account IDs and player profiles

Each user has a unique **TPC account ID** which serves as the main identifier
when locating players. Most endpoints accept either an `accountId` or a
Telegram ID. When a profile is requested the server first tries to find the
account by `accountId`. Missing details such as the name or avatar are
automatically filled from Telegram when a `telegramId` is provided.

### Claiming TPC on-chain

Withdrawals and `/claim-external` trigger a signed message to
`CLAIM_CONTRACT_ADDRESS` using the mnemonic in `CLAIM_WALLET_MNEMONIC`.
The `tpc_claim_wallet` contract forwards this call to the TPC Jetton root
(`EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X`) so the specified amount of
TPC is transferred directly to the provided address. If the call succeeds the
transaction status becomes `delivered`. Failed claims revert the user's balance
and respond with HTTP 500 while the transaction is removed.
### Common issues

- **Balance always zero** – verify MongoDB is running and `MONGO_URI` points
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


### Referral

List everyone invited by a specific referral code:

```
GET /api/referral/list/<code>
```

The response is an array of users with at least their Telegram ID and
nickname or name fields.


### Customizing Snakes & Ladders icons

All webapp icons are stored under `webapp/public`. The board uses emoji symbols
(🐍, 🪜 and 🎲) for snake, ladder and dice connectors instead of the old SVG
files.

Token icons for the lobby and wallet are now stored as WebP files:

- `assets/icons/TON.webp`
- `assets/icons/Usdt.webp`
- `assets/icons/ezgif-54c96d8a9b9236.webp`

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
### Dynamic lobby example

A simplified Socket.IO lobby is provided in `examples/dynamic-lobby`. Players join tables by game type and stake, and the server creates new tables as needed. When a table fills up it emits a `gameStart` event.

If a multiplayer board appears empty, ensure the web server is running and that all players load the game with the same `table` parameter. The client now fetches board data from `/api/snake/board/:id` whenever a table ID is present in the URL or stored from a previous session. If this request fails a local board is used which will not match other players.

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

**X API not configured** – When no `TWITTER_BEARER_TOKEN` is provided the server now skips verification for X related tasks and completes them automatically. Add the token in `bot/.env` if you need strict checks.

**Influencer admin shows "No submissions"** – Ensure your developer token is set in `bot/.env` via `AIRDROP_ADMIN_TOKENS` and in `webapp/.env` through `VITE_API_AUTH_TOKEN` so the webapp can fetch pending submissions.

**Telegram reaction not detected** – The `/api/tasks/verify-telegram-reaction` endpoint relies on `BOT_TOKEN`. If this token is missing the check is skipped and the task automatically succeeds. Configure it only if you require strict validation.

### Banning a user

Run `npm run ban-user -- <accountId>` to mark an account as banned in the database. `MONGO_URI` must point to your MongoDB instance.

### Claim test script

Run `npm run claim-test <TON_ADDRESS> <AMOUNT>` to send TPC from the claim wallet manually. The amount is specified in nanoTPC as expected by `tonClaim`.

### Refund pending withdrawals

Run `npm run refund-withdrawals` to return all pending withdrawal amounts to user balances. `MONGO_URI` must point to your MongoDB instance.

### Reset database

Run `npm run reset-db` to drop the existing MongoDB database and start with a clean one where all user balances are reset to zero. `MONGO_URI` must point to your MongoDB instance.

### Deploying the claim wallet

1. **Compile the contract**. Install the FunC compiler and Fift tools, then run:

   ```bash
   func -SPA -o build/tpc_claim_wallet.fif \
        stdlib.fc ft/params.fc ft/op-codes.fc ft/discovery-params.fc \
        ft/jetton-utils.fc tpc_claim_wallet.fc
   echo '"build/tpc_claim_wallet.fif" include 2 boc+>B "build/tpc_claim_wallet.boc" B>file' | fift -s
   ```

2. **Deploy the contract** using the admin wallet defined by `CLAIM_WALLET_MNEMONIC`. Send at least `0.2` TON to cover fees and provide the initial data (admin address, empty bundles dictionary, jetton wallet code and content cell). A tonos‑cli example:

   ```bash
   tonos-cli deploy build/tpc_claim_wallet.boc '{}' \
     --wc 0 --value 0.2 --sign ./claim-wallet.keys --abi tpc_claim_wallet.abi.json
   ```

   Replace the parameters with your admin key pair and compiled ABI. Record the resulting address in both bounceable and non-bounceable forms.

3. **Update environment variables**. Set `CLAIM_CONTRACT_ADDRESS` in `bot/.env` to the new address. Keep `CLAIM_WALLET_MNEMONIC` unchanged and ensure `RPC_URL=https://toncenter.com/api/v2/jsonRPC`.

4. **Verify the deployment** on TonScan or with `tonos-cli account <address>` to confirm the contract state is active. Test a small claim using `npm run claim-test` and check that the wallet emits a `send_jettons` transfer.


## License

This project is licensed under the [MIT License](LICENSE).

