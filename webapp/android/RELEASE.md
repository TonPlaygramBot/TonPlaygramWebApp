# Android release process (no binaries in git)

1) Prepare signing
   - Copy `keystore.properties.example` to `webapp/android/keystore.properties`.
   - Fill `storeFile`, `storePassword`, `keyAlias`, `keyPassword` with your release keystore values.

2) Fetch the full-app APK (kept out of git)
   - Export `LAUNCHER_URL` to the hosted, signed `tonplaygram-launcher.apk` (and optionally `LAUNCHER_SHA256`).
   - Run `npm --prefix webapp run fetch:launcher` to place the file at `webapp/public/tonplaygram-launcher.apk` (ignored by git).

3) Build a signed release with local files
   - Run `npm --prefix webapp run build`, then `(cd webapp && npx cap sync android)`. Capacitor copies `webapp/dist` into the native package; do not configure a remote `server.url`.
   - From `webapp/android`, run `./gradlew assembleRelease` (or `bundleRelease`) to generate `app-release.apk/aab`.

4) Publish and wire the download link
   - The `android-apk-release.yml` workflow signs the APK, verifies that the web files are inside it, and uploads `tonplaygram-launcher.apk` to a stable GitHub Release.
   - Set Render's `LAUNCHER_URL` secret to that release asset URL. The deploy fetches it into the web build, so the same-origin homepage link cannot fall through to the SPA HTML page.
   - Set `VITE_ANDROID_APK_URL` (or the legacy `VITE_LAUNCHER_URL`) in the web deployment environment to the new URL so the home page links to the latest APK without committing binaries.

5) Publish the iOS build separately
   - Archive and sign `webapp/ios/App/App.xcworkspace` on macOS with Xcode.
   - Distribute it with TestFlight, the App Store, or another Apple-approved signed installation service.
   - Set `VITE_IOS_INSTALL_URL` to that public installation page. iOS does not install Android APK files.
