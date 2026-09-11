# Android release process (no binaries in git)

1) Prepare signing
   - Copy `keystore.properties.example` to `webapp/android/keystore.properties`.
   - Fill `storeFile`, `storePassword`, `keyAlias`, `keyPassword` with your release keystore values.

2) Fetch the launcher APK (kept out of git)
   - Export `LAUNCHER_URL` to the hosted, signed `tonplaygram-launcher.apk` (and optionally `LAUNCHER_SHA256`).
   - Run `npm --prefix webapp run fetch:launcher` to place the file at `webapp/public/tonplaygram-launcher.apk` (ignored by git).

3) Build a signed release
   - From `webapp/android`, run `./gradlew assembleRelease` (or `bundleRelease`) to generate `app-release.apk/aab`.

4) Publish and wire the download link
   - Upload the generated `app-release.apk` to your CDN/object storage.
   - Set `VITE_LAUNCHER_URL` in the web deployment environment to the new URL so `Home.jsx` links to the latest launcher without committing binaries.
