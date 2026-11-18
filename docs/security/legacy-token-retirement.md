# Legacy token retirement (independent review draft)

The owner reports the previous TPC token compromised/unusable. This patch does not rebrand that on-chain asset as TPG or select a new contract.

- Remove wallet root fallback/import advice and disable tonClaim itself, including callers outside HTTP. It never reads credentials or signs/sends.
- Stop legacy jetton balance and DeDust pool queries. External TPG remains null/unavailable, not zero. App TPG continues using the existing DB API untouched.
- Home and BalanceSummary explicitly show external TPG unavailable. USD estimate is labelled TON-only and excludes app balances and retired tokens.
- Unverified legacy store/Adsgram recipient and LP descriptor are disabled (null), not reassigned. No active recipient consumer was found beyond an unused Wallet import, which was removed.
- No database writes, migration, balance reset, token swap or production change. Internal compatibility names such as tpcBalance remain to avoid accidental DB/API migration; they do not authorize the old asset.

This draft targets main independently of #26128. It blocks only external withdraw/claim routes before any model mutation; account/deposit and wallet/deposit remain byte-for-byte unchanged so existing DB-based game rewards are not disabled here. Those deposit/auth/ledger weaknesses remain separate security blockers and are NOT endorsed as safe. The older stacked #26130 is an alternative, not an additional PR to merge. Existing Snake TON contract configuration is not replaced by a guessed address.

Verification: actual React hooks with mocked network preserve DB fixture777, TON2 and USD6 while external TPG stays unavailable; no jetton/DeDust query. Node tests confirm signer refusal and disabled metadata; actual external-payout router checks reject before any side effect. No real wallet, chain, full browser or production test.

Independent-branch verification additionally compared wallet/deposit's complete source handler with main byte-for-byte and confirmed account.js has no diff. Historical walletRoutes tests expect enabled payout rollback and would require updated fixtures/assertions for the new403contract; they were not run and are not claimed passing. No full app build/E2E was performed. Independent review is required before merge/deploy.
