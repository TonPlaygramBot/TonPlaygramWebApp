# TonPlaygram home-page installation and Android release

## Status of this change

The home card, PWA/cache fixes and a signed-APK workflow are implemented in source. This is not an already-built APK or a deployed release. At inspection on 6 September 2026, the repository had no published GitHub releases. The home card therefore correctly shows “APK not published yet”.

The existing `Home.jsx` already mounts `PwaDownloadFrame`; this change replaces that card without rewriting the home page or game routes. The Android package remains `com.tonplaygram.app`. Capacitor copies the complete Vite `dist` build into the Android app, rather than loading a remote homepage. Server-side account services, wallet transactions, multiplayer and any remotely fetched assets still need internet. The APK is Android-only; iPhone users use the PWA route.

## Release from a phone using GitHub

1. Review and merge this change. Deploy the web app/backend together so the HTTPS localhost Capacitor origin is allowed by the existing CORS resolver. Keep all normal authentication checks enabled; an Origin header is not proof of app identity.
2. In the GitHub environment `mobile-store-release`, configure the existing release-signing secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Do not paste signing keys or passwords into chat, commit them, or generate a throwaway key for a public release. Back up the stable signing key privately. If Google Play manages a different app-signing key, its upload key is not automatically a compatible direct-download signing key.
3. Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the real HTTPS production servers, plus `VITE_SOCKET_PATH` and `VITE_GOOGLE_CLIENT_ID` when used. Build-time VITE values are public configuration, not a place for private API secrets. Add the correct native OAuth/signing-certificate configuration and required push-notification configuration through the existing app setup.
4. Under Actions, open **Android signed APK (full app)**. Run it on `main` with an increased version code (the current source default is 2) and version name such as `1.1.1`. Leave **publish** off for the first device test. The workflow validates inputs, runs focused tests, builds the entire app, signs the release APK, checks the signature and non-debug package, then uploads `TonPlaygram.apk` and its SHA-256 file as an artifact.
5. Download the artifact and extract the APK. Test a fresh installation and an update over the previous signed version on a physical Android phone. Verify launch, Android Back, deep links, sign-in outside Telegram, wallet connect/return, API access, online matchmaking, WebGL games, audio, app resume, and offline/error screens. Installation as an APK does not supply Telegram Mini App initData automatically; the existing standalone account flow must work.
6. After device validation, run the workflow on `main` with **publish** enabled and a version code above all previously published or distributed releases. The publish job creates `android-v<version>-<code>` with `TonPlaygram.apk` and `TonPlaygram.apk.sha256`. The home card discovers the published release through GitHub’s latest-release API and enables the real download. Do not make unrelated releases “latest” without adjusting the discovery strategy.

No release is automatically published on push or merge by this new workflow. Existing launcher/debug/store workflows are left unchanged; use this specifically named workflow for the home-page APK. GitHub’s public API can be rate-limited; the card exposes a retry state rather than fabricating a download link.

## PWA/cache behavior

The browser-install prompt is shared by the layout banner and home card. A cancelled or consumed prompt is not reused. Dismissing the banner does not permanently disable the explicit home-card install action. An accepted prompt is not labelled “installed” until the browser confirms installation. Merely loading the Telegram SDK is not treated as running inside Telegram. Opening the external browser does not forward account query strings or Telegram auth fragments.

Caching is an optional, cancellable action with bounded network/service-worker waits. Files that cannot be fetched remain visible as failures, and a partial download never marks the full cache version complete. Only public same-origin files listed in the existing offline manifest are saved. Already cached files are reused. The static manifest is not a guarantee that every dynamically loaded game asset is available offline. Existing per-game warming/loading code is retained.

The service worker no longer auto-activates or reloads users during play. Use **Cache & web-app updates → Check for web-app updates → Apply update & reload**. An active-game flag prevents the explicit reload. APK updates are new signed APK installations, not PWA refreshes. API/auth traffic, third-party fetch APIs and APK downloads are not service-worker cached. Cache cleanup only deletes owned static/runtime caches.

## Validation and remaining gates

Run focused tests from the repository root:

```sh
node --experimental-vm-modules --test tests/pwa-install.test.mjs
```

The implementation was checked locally with 43 focused Node tests, JSX transpilation, YAML parsing and a portrait card-layout check. These use isolated browser/Capacitor mocks where necessary and are not a production Vite build, Android compilation, emulator run, wallet audit, or physical-device test. The local environment could not clone/download dependencies and did not have a configured Android SDK. The signed release workflow and the device tests above remain required before public distribution.

Relevant platform documentation:
- https://capacitorjs.com/docs/v6/config
- https://capacitorjs.com/docs/android
- https://developer.android.com/studio/publish/app-signing
- https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
