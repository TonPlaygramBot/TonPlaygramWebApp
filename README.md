# TonPlaygram MiniApp

This repository contains the skeleton structure for the TonPlaygram MiniApp.
Copy `.env.example` to `.env` and then run:

```bash
npm install
npm run dev
```

This will start the Vite development server.

To run tests use:

```bash
npm test
```

## Bot Development

The server code lives in `server/` and uses Express together with Telegraf. To run the bot locally:

```bash
cd server
npm install
TELEGRAM_BOT_TOKEN=<your token> npm start
```

During production the bot uses webhooks. Set `RENDER_EXTERNAL_URL` to the deployed base URL and configure your Render service accordingly.
