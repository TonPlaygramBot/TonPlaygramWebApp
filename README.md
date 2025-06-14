if (!data.nickname || !data.photo || !data.firstName || !data.lastName) {

  setAutoUpdating(true);

  try {

    let tg;

    try {

      tg = await fetchTelegramInfo(getTelegramId());

    } catch (err) {

      console.error('fetchTelegramInfo failed', err);

    }

    const firstName = data.firstName || tg?.firstName || getTelegramFirstName();

    const lastName = data.lastName || tg?.lastName || getTelegramLastName();

    const photo = data.photo || tg?.photoUrl || '';

    const updated = await updateProfile({

      telegramId: getTelegramId(),

      nickname: data.nickname || firstName,

      photo,

      firstName,

      lastName,

    });

    // Set profile and show Telegram info notice if any field was filled

    setProfile({ ...updated, filledFromTelegram: true });

    setForm({

      nickname: updated.nickname || '',

      photo: updated.photo || '',

      bio: updated.bio || '',

    });

  } finally {

    setAutoUpdating(false);

  }

}

// When the profile is updated from Telegram, the UI briefly displays a

// notification that says `Info retrieved from Telegram`.

// The `/api/profile/get` endpoint now returns a `filledFromTelegram` flag

// whenever missing fields were populated from Telegram so the client can

// show this notice even on the first load.

## Setup

1. Copy the example environment file and adjust the values:

```bash
cp bot/.env.example bot/.env
```

The following variables are required:

- `BOT_TOKEN` &ndash; your Telegram bot token.
- `MONGODB_URI` &ndash; valid MongoDB connection string, e.g. `mongodb://localhost:27017/tonplaygram`.

Google OAuth variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`) are optional and only needed if you enable Google login.

2. Install dependencies:

```bash
npm install
```

3. Start the bot server:

```bash
npm start
```

4. In a separate terminal, start the React app for development:

```bash
cd webapp
npm run dev
```
