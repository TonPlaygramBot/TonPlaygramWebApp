# Telegram launcher APK

Place the Telegram-friendly APK that bundles the full TonPlaygram web app and games in this folder as
`tonplaygram-telegram-launcher.apk` (or override the name with `TELEGRAM_APK_FILE`). The backend exposes it at
`/downloads/<filename>` and the web app auto-discovers the download link via `/api/downloads/apk`.
