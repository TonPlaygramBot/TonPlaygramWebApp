## Mobile push, deep links, and launcher distribution

The native shells already include intent filters (Android) and URL schemes/associated domains (iOS) for `https://tonplaygram.com`, `https://api.tonplaygram.com`, `https://tonplaygram.app`, `tonplaygram://`, and `tonconnect://tonplaygram.com`. Use these steps to finish platform setup without committing secrets or binaries.

### Firebase Cloud Messaging (Android & iOS)

1. **Create a Firebase project** and add both Android and iOS apps that match the existing bundle IDs:
   - Android package name: `com.tonplaygram.app`
   - iOS bundle identifier: `com.tonplaygram.app`
2. **Download configs (do not commit):**
   - `google-services.json` → `webapp/android/app/`
   - `GoogleService-Info.plist` → `webapp/ios/App/App/`
3. **iOS APNs:** upload your APNs key/cert to Firebase and enable Push Notifications capability in Xcode for the `App` target (Signing & Capabilities → add *Push Notifications* and *Background Modes* if needed).
4. **Backend FCM key:** keep the FCM server key available to the bot/API service so outbound notifications can be sent. Store it as a runtime secret (environment variable or secret manager); do not commit it.
5. After updating configs, run `npx cap sync` from `webapp` to propagate them into the native projects.

### Backend token registration

`/api/push/register` already accepts push tokens and stores up to five per user. Ensure the bot service has network access to Firebase Cloud Messaging using the configured server key for sending.

### Universal Links / App Links

Publish the following files at the domain roots (do not store production secrets in git):

- **Android:** `https://<domain>/.well-known/assetlinks.json`
- **iOS:** `https://<domain>/apple-app-site-association`

Templates (replace placeholders):

```jsonc
// assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tonplaygram.app",
      "sha256_cert_fingerprints": ["<SHA-256-FINGERPRINT>"]
    }
  }
]
```

```jsonc
// apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAMID>.com.tonplaygram.app",
        "paths": ["*"]
      }
    ]
  }
}
```

Host the same files for `tonplaygram.com`, `api.tonplaygram.com`, and `tonplaygram.app` so verification covers all configured hosts.

### Launcher artifact

Provide the signed launcher APK at a stable URL and set:

```
LAUNCHER_URL=<https-url-to-signed-launcher-apk>
LAUNCHER_SHA256=<optional-expected-sha256>
```

Then run `npm --prefix webapp run fetch:launcher` to download it into `webapp/public/tonplaygram-launcher.apk` (gitignored). Do not commit the APK; publish it to a durable store such as S3 or a release asset.

### Deep link testing

- **Android/iOS native builds:** verify that `https://tonplaygram.com` links and the `tonplaygram://` / `tonconnect://tonplaygram.com` schemes open the app in both debug and release builds.
- **Web:** confirm the same links resolve correctly in browsers and that the App/Universal Link files are served with proper `Content-Type` (`application/json` for assetlinks, `application/json` or `application/pkc7-mime` for AASA).
