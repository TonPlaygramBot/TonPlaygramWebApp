# Installable TonPlaygram releases

The existing Capacitor Android and iOS projects package the built web application
from `webapp/dist`. The bot, database, authentication and multiplayer services
remain on the server. Never ship server secrets inside the application.

## Android direct download

1. Increase `versionCode` and `versionName` in `android/app/build.gradle` for each
   update. Keep the same signing key so installed applications can upgrade.
2. Configure the existing `mobile-store-release` GitHub environment:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`, and the production `VITE_API_BASE_URL`.
   Set `VITE_SOCKET_URL`, `VITE_SOCKET_PATH`, and `VITE_GOOGLE_CLIENT_ID` as needed.
   Use the existing production signing key; do not generate a replacement for updates.
3. Run **Signed Android app download** with a new tag such as `android-v1.1.1`.
   It builds the complete web app, synchronizes Capacitor from the webapp directory,
   builds a signed release APK, verifies its signature and prepares a draft GitHub
   release with `tonplaygram.apk` and its SHA-256 checksum.
4. Download the workflow artifact and test on a physical Android device:
   fresh install, upgrade, launch, account sign-in, wallet return links,
   games, uploads and multiplayer connectivity.
5. Publish the reviewed draft release. Copy the public APK asset URL into
   `VITE_ANDROID_APK_URL` in the web deployment environment and rebuild/redeploy
   the website. Home shows **Download Android APK** when that URL is configured.
   `VITE_LAUNCHER_URL` remains a backwards-compatible fallback.
   Do not use an Actions artifact URL or a draft-release URL for public users.

The APK is the installable download. An AAB from the separate Android store
workflow is intended for Google Play and cannot be installed directly.

## iPhone and iPad

The existing `webapp/ios` project requires an Apple-signed distribution build.
Publish through your Apple distribution process, then put the real App Store or
TestFlight HTTPS URL in `VITE_IOS_APP_URL` and rebuild/redeploy the website.
Until that URL exists, Home offers Safari Add to Home Screen instructions.

## Browser installation (phones and desktops)

Home exposes the browser installation prompt where supported and menu instructions
otherwise. Telegram users are directed to their external browser. Installed native
apps show an installed status instead of redundant download controls.

Keep the deployed HTTPS manifest and service worker working. Browser installation
does not produce a native APK, IPA, Windows installer or macOS installer.
The separate save-assets controls below remain available for faster loading.

## Validation

Run `node --test test/appDownloads.node.mjs` from the repository root, then
`npm --prefix webapp run build`. Verify Home at 390px portrait width,
browser prompt acceptance/cancellation, Safari guidance, Telegram external opening,
missing download URLs and the real published APK/App Store destinations.

No release is published automatically by the signed APK workflow.
