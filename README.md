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
2. Install dependencies and start the bot (this will also build the web app):
   ```bash
   cd bot
   npm install
   npm start
   ```
   The start script automatically runs `npm --prefix ../webapp run build` so the
   compiled files are available in `webapp/dist`. If this build step fails,
   you'll see a blank page when visiting the site.

The bot exposes a simple `/start` command that records users in MongoDB and offers a button to open the web app.

### Mining demo

Use `/mine start` to begin mining, `/mine stop` to pause, and `/mine claim` to collect pending TPC. `/mine status` shows your current mining state and unclaimed rewards.

### Tasks demo

Use `/tasks` to view available tasks. Complete a task with `/tasks complete <id>` to earn additional TPC.
