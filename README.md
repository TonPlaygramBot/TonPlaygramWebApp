# TonPlaygram Monorepo

This project contains a Telegram bot and a companion web application.

## Setup

1. Copy `bot/.env.example` to `bot/.env` and fill in your credentials. This
   repository already contains an example token in `bot/.env`, but you should
   replace it with your own if deploying publicly:
   ```
   BOT_TOKEN=<your telegram bot token>
   MONGODB_URI=<your mongodb connection string>
   PORT=3000
   ```
2. Install dependencies and start the bot:
```bash
cd bot
npm install
npm start
```
   The server automatically builds the web app if the compiled files are missing. It also checks that the build output contains the `assets` directory. If your environment requires a proxy to access the Telegram API, set `HTTPS_PROXY` (or `https_proxy`) before starting the bot. Set `SKIP_BOT_LAUNCH=1` to skip launching the Telegram bot if network access is unavailable.

   To open the web app without running the server, build it manually and open `webapp/dist/index.html` in your browser:
   ```bash
   npm --prefix webapp install
   npm --prefix webapp run build
   ```

The bot exposes a simple `/start` command that records users in MongoDB and offers a button to open the web app.

### Mining demo

Use `/mine start` to begin mining, `/mine stop` to pause, and `/mine claim` to collect pending TPC. `/mine status` shows your current mining state and unclaimed rewards.

### Tasks demo

Use `/tasks` to view available tasks. Complete a task with `/tasks complete <id>` to earn additional TPC.

### Watch-to-earn demo

Use `/watch` to see available videos. Watching a video via the web app awards the listed TPC once per video.
