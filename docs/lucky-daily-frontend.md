# Lucky Card daily reward migration scope

The automatic daily 100 TPC claim now sends an empty authenticated request to
`POST /api/lucky-daily/claim`. The server owns identity, UTC date, eligibility,
amount and the atomic balance update. The frontend does not read or write
`luckyCard1Claimed` to authorize a claim, and never computes the daily balance.
Lost responses and sign-in failures show a retry action. Only a confirmed server
receipt updates the displayed wallet; already-claimed receipts are safe retries.
Unmounted requests do not update the UI. React Strict Mode may issue two requests;
server atomic once-per-account/day enforcement is required.

This is deliberately NOT a migration of dice/card prizes: that flow still reads
and writes balances and locally awards spin bonuses. Its existing cooldown and
random selection are unchanged. Those remaining client-authoritative operations
must be separately secured before claiming platform-wide reward integrity.

Verification: focused component tests cover confirmed/duplicate daily responses,
authentication failure and retry, no client identity/date/amount, forged local
eligibility, network ambiguity, invalid receipts, repeated retry clicks and late
responses after unmount/Strict Mode. Real API, mobile/device and full production
build verification are separate deployment gates.

Account switching: UI response routing includes accountId, Google identity and
runtime Telegram identity. Auth/account/storage events synchronously invalidate
pending responses and start a fresh claim. Responses also recheck the live
identity before updating a wallet, even before React processes an auth event.
Google-only A-to-B in-flight switching and all four notification paths are tested.
