# TonPlaygram WebApp

This repository contains the skeleton structure for the TonPlaygram WebApp.
Copy `.env.example` to `.env` and then run:

```bash
npm install
npm run dev
```

This will start the Vite development server.

To create a production build run:

```bash
npm run build
npm run serve
```

Always access the app through the dev server or the preview server rather than opening `index.html` directly.
The React app uses HashRouter to ensure pages load correctly when hosted statically.

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
