# Android and iOS publication readiness

Reviewed 15 November 2026 against `main` at
`d0d5ba30bbd697b2c22452f722c63cd51f1ad0b6`.

**Status: not ready for public store submission.** This is a source review and
limited regression validation, not a successful native build, penetration test,
store approval, or physical-device certification. The proposed changes do not
deploy to Render, submit an app, change the database, or change game rules.

## What already exists

- A shared React web app and Capacitor Android/iOS projects using
  `com.tonplaygram.app`, with portrait orientation and bundled `dist` assets.
- Android compile/target API 36, release-signing configuration, and a manually
  triggered signed-AAB workflow. Signing credentials are not in source control.
- An iOS project, app privacy manifest, icon generation, and a manually triggered
  unsigned native build workflow.
- Public privacy, terms and account-deletion pages; an in-app deletion control;
  Google/Telegram credential verification for account creation and private social
  operations; encrypted messaging and message expiry/deletion controls.
- A documented first-store free-play policy in
  [mobile-store-release-scope.md](mobile-store-release-scope.md).

## Safe corrections in this change

- Run Capacitor synchronization inside `webapp`, where its configuration lives.
- Make the Android store workflow's signing-key path resolve to the actual key.
- Stop treating `bundleDebug` as a release-signing task. Preserve release signing
  protection and make the automatic APK workflow produce debug artifacts only.
- Request the actual Xcode `archive` action and fail artifact upload if the
  expected native output is missing. An unsigned archive is not a store upload.
- Correct the iOS storyboard's bridge controller reference without installing
  the unused custom navigation delegate that fires Back on page loads.
- Declare camera/microphone access for existing calls, with the iOS usage text.
  Device consent, denial, retry and background behavior still require testing.
- Stop generating fake Telegram `initData` from native profile/deep-link metadata.
  Genuine Telegram credentials retain their existing verification path; native
  Google authentication no longer gets an extra fabricated Telegram credential.

## Release blockers and acceptance criteria

| Priority | Evidence in this checkout | Required result before submission |
| --- | --- | --- |
| P0: account and balance security | `bot/middleware/auth.js` and account ownership checks still trust compatibility identity headers in some routes; reward credit is client-driven. | Require verified identity for every protected route; authorize each account operation; make reward/settlement authority server-owned and replay-safe. Add cross-account rejection, forged-identity and duplicate-settlement tests before enabling public financial flows. |
| P0: complete account deletion | `bot/routes/profile.js` only permits Telegram/API-token deletion and deletes the `User` document. Social messages, posts, friendship records and media have separate storage. | Support every offered login method with fresh authentication; implement and test an explicit data-deletion/retention plan across collections, media, push tokens and sessions. Verify in-app and external web requests and realistic pending-activity handling. |
| P0: social safety | Reporting/blocking flows were not found in the inspected social routes and UI. Message deletion/encryption exists. | Implement report content/user, block/unblock, server enforcement for messages/calls/invites, moderation handling, terms acceptance, and a reachable support process. Validate abuse handling and age/child-safety obligations for the chosen category. |
| P0: store business model | No StoreKit/Play Billing integration found. Existing `MOBILE_STORE_MODE` gates selected wallet routes, not all account, reward, gift or purchase paths. | Classify each currency, digital item, premium video, entry fee and prize. Implement applicable billing and regional restrictions or an explicitly approved free-play scope. Prove server enforcement; do not hide functionality only during review. |
| P1: standalone sign-in | Google uses web Identity Services; Telegram opens a Mini App. Wallet-only UI copy does not match the signed-identity requirement for account creation. | Test fresh installation without Telegram, sign-in/linking/restoration/logout/expired credentials on both OSes. Provide the required equivalent private login on iOS where Apple guideline 4.8 applies; align UI with actual supported login paths. |
| P1: Android toolchain | API 36 is configured with AGP/Gradle 8.2.1. | Upgrade to a mutually supported toolchain in a separate tested change; AGP 8.10 supports API 36 with Gradle 8.11.1/JDK 17. Validate all native plugins, Android lint, a signed AAB, native library page-size compatibility and real-device install/update. Do not suppress compatibility warnings as a substitute. |
| P1: iOS assets and distribution | `generate-native-assets.mjs` emits RGBA icons and duplicate universal 3x splash slots. Workflow produces an unsigned archive only. | Generate valid opaque App Store icons and unique asset slots; compile with Xcode 26+/iOS 26 SDK+, validate/archive with the owner's signing team, export/upload to TestFlight and complete App Store validation. |
| P1: privacy and permissions | Privacy pages/manifest exist; camera, media, biometrics, push and social data are used. | Reconcile actual collection/sharing/retention with Apple App Privacy, SDK manifests/required-reason APIs, Google Data safety and encryption export declarations. Test denied/revoked permissions. Existing policy text is not evidence of implementation. |
| P1: push and verified links | Domain associations and Firebase/APNs setup are described in `mobile-deployment-notes.md`; credentials and live associations were not inspected. | Verify signing fingerprint/team-specific association files, push entitlements/registration/delivery, and login/invite/wallet callback links on installed apps. Test foreground/background/cold start. |
| P1: whole-platform quality | No signed native device run was performed in this review. Large game assets, remote APIs and online play are part of the app. | Test every exposed game and social flow on physical Android/iPhone portrait devices, including slow/offline recovery, download size/storage, heat/memory, calls during games, purchase failures and upgrade persistence. Review mini-game catalog, deep links and age access under Apple 4.7. |

`MOBILE_STORE_MODE` is a backend-wide setting, not a proven per-store-client
boundary. Do not flip live environment variables as part of this PR: the shared
web/Telegram service may be affected. Inspect deployed settings and design the
release scope explicitly. Never weaken authentication to make a native shell work.

## Order of work

1. Review and merge these focused native corrections after checks. Keep Render
   deployment behavior and current web flows under regression coverage.
2. Resolve P0 identity, rewards, deletion, moderation and payment-scope blockers in
   separate changes with backend integration tests and a rollback plan.
3. Complete the toolchain/assets/privacy/push/link work, then produce a signed
   Android AAB and signed iOS archive from an identified commit.
4. Run Google Play internal/closed testing and TestFlight. For new personal Play
   accounts covered by Google's rule, complete 12 opted-in testers for 14
   continuous days and apply for production access.
5. Submit accurate listings, phone screenshots, ratings, data declarations,
   support/privacy/deletion URLs and reviewer instructions/accounts. Submit only
   after beta results and the exact enabled business model are approved.

## Owner/account inputs still needed

- Google Play Console and Apple Developer/App Store Connect account status,
  organization/legal entity, intended countries and age audience.
- Existing app records and whether `com.tonplaygram.app` is already registered;
  last uploaded Android version code and iOS version/build numbers.
- Android upload key and Play App Signing setup; Apple team, distribution
  certificate/provisioning and push credentials, entered in the appropriate
  platform/secret manager, never committed or pasted into chat.
- Final payment/token/prize scope, support and moderation ownership, working
  production API/socket domains, provider credentials and reviewer test access.

## Validation record

The PR description records exact checks and outcomes. Native builds/signing,
store-console settings, live backend settings and physical-phone behavior have
not been verified in this Linux environment. The checkout used for source review
omits large game assets; no full-platform production-build result is claimed.

An existing `test/mobileProfileAccess.test.js` assertion expects wallet-only
account initialization that current `MyAccount.jsx` no longer contains. That
assertion fails on the reviewed source; this change does not modify either file
or restore the insecure/unsupported sign-in path just to satisfy the assertion.

## Official requirements checked on 15 November 2026

- [Google target API policy](https://support.google.com/googleplay/android-developer/answer/11926878): new apps and updates require API 36 from 31 August 2026; the extension ended 1 November.
- [Android AGP 8.10 compatibility](https://developer.android.com/build/releases/past-releases/agp-8-10-0-release-notes).
- [Apple SDK upload requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a): Xcode 26+ and iOS 26 SDK+ since 28 April 2026.
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/): user content, digital purchases, mini-games, login, privacy, cryptocurrency and real-money gaming.
- [Google payments](https://support.google.com/googleplay/android-developer/answer/10281818), [real-money games](https://support.google.com/googleplay/android-developer/answer/9877032) and [blockchain content](https://support.google.com/googleplay/android-developer/answer/13607354).
- [Google account deletion](https://support.google.com/googleplay/android-developer/answer/10144311) and [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- [Google user-generated content](https://support.google.com/googleplay/android-developer/answer/9876937), [child safety standards](https://support.google.com/googleplay/android-developer/answer/14747720) and [personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465).
- [Apple third-party SDK privacy requirements](https://developer.apple.com/support/third-party-SDK-requirements/) and [encryption/export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance).
- [Android 16 KB page-size compatibility](https://developer.android.com/guide/practices/page-sizes).

Policies and enforcement dates can change; re-check these sources at submission.
