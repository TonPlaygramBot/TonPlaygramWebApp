---

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

4. Copy `webapp/.env.example` to `webapp/.env` and configure:
   - `VITE_API_BASE_URL` – the base URL where the bot API is hosted (e.g. `http://localhost:3000`).
     If omitted, the webapp will connect to the same origin it was served from.
   - `VITE_GOOGLE_CLIENT_ID` – OAuth client ID for Google sign-in.
   - `VITE_DEV_ACCOUNT_ID` – account ID that receives the 9% developer share.

   This value is required for the Google button to appear on the login and
   profile pages. When provided, the webapp lets users sign in with Google and
   stores their Google ID alongside any Telegram information when calling
   `/api/profile/register-google`.

  ⚠️ Misconfiguring these may prevent the wallet from loading correctly.

5. Install the Python requirements for the dice roller:

   ```bash
   pip install -r requirements.txt
   ```

6. Build the webapp assets. This step copies `public/tonconnect-manifest.json`
   into the `dist` folder so wallets can connect:

   ```bash
   npm --prefix webapp run build
   ```

7. Run the test suite to verify the setup:

   ```bash
   npm test
   ```

8. Start the API server and Telegram bot:

   ```bash
   npm start
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


### Wallet overview

This app exposes a single **TPC Wallet** stored in MongoDB. Commands like
`/wallet balance` and `/wallet send` interact with this database record. TON
deposits sent to `DEPOSIT_WALLET_ADDRESS` credit the balance after the transfer
is detected.

### Common issues

- **Balance always zero** – verify MongoDB is running and `MONGODB_URI` points
  to a running database instance. The backend must be able to connect.
- **In-memory database fails to launch** – the app will start without MongoDB if
  the `mongodb-memory-server` download fails.
- **No Telegram notifications** – confirm `npm start` is running and the bot
  token is valid. Users must interact with the bot in Telegram to receive
  messages.
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


Each script will start a bot that responds to commands such as `/roll` or `/start`.

### Customizing Snakes & Ladders icons

All webapp icons are stored in `webapp/public/icons`. The board now uses emoji symbols (🐍, 🪜 and 🎲) for snake, ladder and dice connectors instead of `snake.svg`, `ladder.svg` and `dice.svg`.

Token icons for the lobby and wallet are:

- `TON.png`
- `TPCcoin.png`
- `Usdt.png`

Place your own images with those exact names in `webapp/public/icons` to override them.

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
