# GRAM display audit (2026-11-17)

Official source: https://ton.org/media/. Native currency is Gram (GRAM); network remains TON.

Scanned webapp source JS/JSX/TS/TSX/JSON for literal TON/Toncoin and dynamic transaction/stake token rendering, plus public HTML/PWA manifests and backend error responses. No separate locale/i18n/translation catalogs found in this checkout.

Additional fixes: Wallet, TPG hub and platform-statistics historical transaction labels; Pool/Snooker/Chess/Checkers stake captions; Texas Holdem canvas and HUD captions; offline asset manifest; native-payment-disabled and balance-fetch backend messages. These are display-only: stored history, amounts, network, protocol identifiers and request keys remain unchanged.

Intentionally retained: TON Connect, TON blockchain/ecosystem and network-wallet wording; RPC/API URLs and TON rate/query keys; legacy room tokens and database keys; diagnostic console messages/comments; legacy TON.webp for cached-client compatibility; explanatory “formerly Toncoin” note; unused lpToken.js metadata containing a pre-existing on-chain LP identity (not relabelled without verified LP metadata).

Seven focused tests pass including a rendered legacy TON historical transaction displayed as GRAM while input data and TON Connect branding remain unchanged. This is a source audit, not a claim of exhaustive live-device or authenticated production testing.

Independent residual scan additionally found system notification and Home social invite captions; both now use display mapping. Invite acceptance URLs and stored data retain TON; a rendered invite regression covers this.
