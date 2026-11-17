# Native release asset size preflight

Run `npm --prefix webapp run check:native-size` after a build. This read-only
check measures every regular file in `webapp/dist`, including hidden files and
each hardlink path (Capacitor copies these paths into the native web assets).
It prints JSON with byte count, file count, largest files/groups, budget and
pass/fail. Missing/empty index, symlinks and unreadable paths fail closed.
It does not delete, rewrite, upload or compress any asset.

The default **200 MiB (209715200 bytes)** is a conservative **project safety
budget**, not an Apple/Google store limit. It measures uncompressed webDir input,
not final APK/AAB/IPA size, installation size, native binaries or store eligibility.
Exceeding the budget fails before Capacitor sync in the Android store release and
GitHub APK release workflows. Normal web builds, local native sync, debug APK CI
and the unsigned Android/iOS native-build workflow remain unchanged. There is no
signed iOS release workflow currently covered; add this gate before archive/signing
when one is introduced. Direct Gradle/Xcode commands are not intercepted.

## Controlled override

Release workflow dispatch exposes `native_bundle_max_bytes` and
`native_bundle_size_override_reason`. Raising the budget requires a positive safe
integer and a nonblank reason of at least 12 characters. No unlimited bypass is
provided. A temporary internal-device exception is not permission to publish or
proof of store compatibility. Keep the reason and measured output in release logs.
For local diagnosis (does not sync or sign):

```sh
NATIVE_BUNDLE_MAX_BYTES=314572800 \
NATIVE_BUNDLE_SIZE_OVERRIDE_REASON='Reviewed internal device size experiment' \
npm --prefix webapp run check:native-size
```

Do not routinely raise the budget to accommodate the current multi-GB bundle.
The full build includes high-resolution HDRs/textures; existing native-lite
pruning does not remove most of them. Reducing the bundle is a separate change.
Before moving assets to HTTPS hosting, verify actual deployed URLs, hashes and
all nested texture/model dependencies. Native origin CORS, service-worker/native
cache behavior, offline startup, network loss, retries and cache eviction need
real-device validation. This gate neither establishes CDN availability nor
changes asset resolution or offline behavior.

Tests: `npm --prefix webapp run test:native-size`.
