# Legacy token retirement (dependent on wallet fail-closed draft)

The owner reports the previous TPC token compromised/unusable. This patch does not rebrand that on-chain asset as TPG or select a new contract.

- Remove wallet root fallback/import advice and disable tonClaim itself, including callers outside HTTP. It never reads credentials or signs/sends.
- Stop legacy jetton balance and DeDust pool queries. External TPG remains null/unavailable, not zero. App TPG continues using the existing DB API untouched.
- Home and BalanceSummary explicitly show external TPG unavailable. USD estimate is labelled TON-only and excludes app balances and retired tokens.
- Unverified legacy store/Adsgram recipient and LP descriptor are disabled (null), not reassigned. No active recipient consumer was found beyond an unused Wallet import, which was removed.
- No database writes, migration, balance reset, token swap or production change. Internal compatibility names such as tpcBalance remain to avoid accidental DB/API migration; they do not authorize the old asset.

This draft is stacked on #26128 to avoid wallet handler conflicts. It does not restore the payouts intentionally blocked there, certify another contract or claim all other chain/store configurations audited. Existing Snake TON contract configuration is not replaced by a guessed address.

Verification: actual React hooks with mocked network preserve DB fixture777, TON2 and USD6 while external TPG stays unavailable; no jetton/DeDust query. Node tests confirm signer refusal and disabled metadata; inherited fail-closed router checks remain passing. No real wallet, chain, full browser or production test.
