# One-click Gift Store (release-gated draft)
Based on atomic signed/idempotent delivery draft #26099, not deployable against the legacy /gift endpoint.

Each catalog card offers a separate artwork preview and an explicit Buy & send / Buy for me action. The exact TPG total and recipient are visible on that action before spending; recipient can be set above the grid. Clicking the spending button submits once, without another confirmation screen. Viewing artwork never spends. Signing in and an available recipient are required.

The existing checkout persists its UUID intent before transmission. Busy/ref guards stop rapid duplicate clicks; network retries remain disabled. An ambiguous outcome locks the original gift/recipient into explicit same-key recovery instead of creating a second purchase. Only a matching delivered receipt triggers success, sound and return to gameplay. Durable terminal rejection is visible and does not celebrate. Account switches suppress the prior account's completion UI and clear displayed order/recovery; stored recovery remains scoped to its sender.

TPG prices and canonical token are unchanged. The menu adopts the Store palette. No server/auth/delivery changes are introduced by this follow-up. Keep the standalone86-image artwork from current main during integration; do not overwrite it with the historical parent branch assets.

Verification:22 checkout/catalog node tests and29 UI/API/audio tests pass, including one-click game send, self purchase, explicit recipient snapshot, double taps, ambiguous same-key recovery, storage failure, terminal rejection and account switch. No live transactions. Existing13 real replica-set integration passes belong to #26099; this pass did not rerun them because root dependency mongoose is absent from this isolated checkout. Browser visual QA remains blocked by local Chromium socket permission restrictions and cloud preview reachability.

Release gates: coordinated signed-session/legacy-client migration; replica-set production requirements; external NFT-provider integration (parent draft fails closed if configured); notification and receipt retention decisions; device interaction/audio/layout QA; reviewed integration with main. Do not deploy this UI alone to the old gift endpoint.
