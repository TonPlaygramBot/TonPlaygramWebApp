# TonPlaygram Monorepo

This project contains a Telegram bot and a companion web application.

## Setup

1. Copy `bot/.env.example` to `bot/.env` and fill in your credentials. This
   repository already contains an example token in `bot/.env`, but you should
   replace it with your own if deploying publicly:
   ```
   BOT_TOKEN=<your telegram bot token>
   # Set MONGODB_URI=memory to run without a real MongoDB server
   MONGODB_URI=<your mongodb connection string or 'memory'>
   PORT=3000
   ```
2. Copy `webapp/.env.example` to `webapp/.env`. The default value points the
   front-end at the local bot server:
   ```
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. Start the bot **from the `bot` directory** so its `.env` file is loaded:
```bash
cd bot
npm start
```
   Alternatively run `npm start` from the repository root, which simply
   launches `node bot/server.js`. This helps hosting platforms that expect a
   top-level `package.json`.
   By default `.env` sets `MONGODB_URI=memory`, so the server starts with an in-memory MongoDB instance. Replace it with your own connection string when running in production.



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

### Deployment on Render


