## Native permissions and store declarations

- **Runtime permissions:** none required. The app only needs internet access to reach the TonPlaygram API and TonConnect endpoints.
- **Background modes:** none enabled.
- **Biometrics:** not requested unless enabled through Capacitor biometric plugin when available; no usage strings beyond Info.plist defaults are added here.

### Play Store declarations
- Uses **`android.permission.INTERNET`** for API access at `https://api.tonplaygram.com`.
- Handles app links for `https://app.tonplaygram.com` and custom TonConnect callbacks via the `tonplaygram://` scheme.

### App Store declarations
- Associated domains: `applinks:app.tonplaygram.com` and `applinks:tonplaygram.com` for universal links.
- Launch screen and icons are generated from repository assets during the build; no additional native capabilities are requested.
