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
3. For the web app:
   ```bash
   cd webapp
   npm install
   npm run build
   ```
   The compiled files will be placed in `webapp/dist`. Start the bot after
   building so Express can serve these static files. If you skip this step, the
   site will appear blank when visiting the server.

The bot exposes a simple `/start` command that records users in MongoDB and offers a button to open the web app.

### Mining demo

Use `/mine start` to begin mining, `/mine stop` to pause, and `/mine claim` to collect pending TPC. `/mine status` shows your current mining state and unclaimed rewards.

### Tasks demo

Use `/tasks` to view available tasks. Complete a task with `/tasks complete <id>` to earn additional TPC.
