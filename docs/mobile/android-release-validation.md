# Android API 36 release validation

This change prepares a reviewable toolchain and fails closed on oversized native web payloads. It does not certify store readiness or publish an app.

## Pinned toolchain

- compile/target SDK remain 36; AGP becomes 8.10.1 and Gradle 8.11.1.
- CI uses Java 17 and installs Android platform 36 plus build tools 35.0.0 (AGP default) and 36.0.0.
- Gradle distribution and separately downloaded wrapper JAR are SHA-256 pinned. Existing wrappers are verified too.
- Sources: https://developer.android.com/build/releases/agp-8-10-0-release-notes and https://gradle.org/release-checksums/.

## Packaging gate

The signed-release workflow now requires repository variable `GAME_PACK_CDN_BASE_URL` and builds through `build:native-lite`. The value must be a public HTTPS base URL without credentials, query or fragment. Literal IP addresses (including public ones), single-label hosts and local host suffixes are rejected; use a DNS CDN hostname. This syntactic check does not resolve DNS or prove public reachability. Verify DNS, HTTPS access and CORS from an actual device before release. Do not put credentials in this variable.

The existing CDN manifests drive removal of recoverable game payloads. All manifest paths, removable asset sources and symlink boundaries are checked before deletion begins. Covers and explicitly non-removable files remain. Empty directories can now be removed correctly. A post-prune audit checks a nonempty entry point, CDN catalog, prune report, regular files only and a 150 MiB **uncompressed engineering shell budget**. This is not a claim about Play or Apple compressed download limits.

No CDN configuration or production flags were changed. The current generated application pack can still expose a whole-application download. This work does not implement per-game download UX or prove caching in native WebViews.

## Evidence and remaining gates

Local checks: 33 Node tests (10 new native release checks plus existing app manifest/recovery checks), 3 existing pack-delivery Jest tests; explicit scripts ESLint and whitespace validation. Official wrapper and Gradle archive hashes verified; Gradle 8.11.1 runs on installed Java 21. Capacitor Android sync succeeds with all five plugins using a clearly labeled compile-only HTML fixture.

Actual Android compilation has **not passed locally**. This environment has no Android SDK. Online Gradle resolved the Android plugin but stopped at an unwritable default Android config directory; offline execution lacked dependency caches. No signed APK/AAB, emulator, phone or WebGL test was produced. No full multi-gigabyte web build was run for this change.

The new PR workflow uses Java 17 and an installed SDK to run native unit tests, lint and debug compilation with a compile-only fixture. It deliberately does not upload that APK. Passing it validates native plugins/toolchain only, not the real game payload or gameplay.

Before release: pass native CI; run the real CDN-backed web build and inspect its measured budget; verify CDN asset hashes, availability and CORS; test cold start, downloads, interrupted-download recovery, offline restore, authentication, push and biometric behavior on actual Android devices. Validate Android 16 edge-to-edge/insets and game WebGL performance. Signed release and Play submission need separately verified signing/account access and approval. iOS/Xcode/device validation remains separate.
