# Gift atelier and portrait UI polish

## Review scope

Prepared against `3c5ac8c5df45f07865d37ce7dc5833ef3142a2f7` in the active `webapp/` application. Source review covered app routing, the shared layout/navigation, dialogs, gift shop, in-game gift picker, owned gift shelf, NFT inventory, API call contract, both gift catalogs, and the mint-service shim.

This is not a completed end-to-end audit of every authenticated route, every game, or the live production site. The live application is a JavaScript app and authenticated production flows were not exercised. No real purchases, transfers, burns, mint operations, or deployment changes were made during this work.

## Implemented

- Expand the catalog from 14 to 86 gifts: all original IDs, prices, tiers and fallback receipt icons are retained, plus 72 new named designs across Royal, Cosmos, Companions, Sweet Shop, Arcade, Botanical, Treasury and Mythic.
- One canonical `shared/giftCatalog.js`, re-exported by the web client and server, eliminates divergent prices and IDs. New gift prices are proposed catalog values and should be approved before release.
- Original vector artwork for every gift, using 71 distinct motifs and coordinated palettes. No external image service or emoji rendering is required for catalog art. Existing GiftIcon consumers also receive the updated artwork.
- Portrait-first storefront with two columns on phones, four on wider screens, search, collection/tier filters, sorting, pagination, gift details, recipient review, explicit confirmation, persistent success/errors, and duplicate-tap protection.
- Optional React + Three.js + TypeScript viewer. Some designs use procedural full sculptures and others use beveled SVG reliefs; these are not 86 independently authored full 3D asset files. Only the selected detail view opens a canvas. DPR is capped, hidden canvases stop, reduced motion is respected, resources are disposed and errors fall back to artwork.
- The gift shelf and NFT inventory share the new presentation. Conversion retains the existing server endpoint, adds a confirmation and guards repeated taps. The displayed catalog price is not represented as a guaranteed conversion refund.
- Separate the NFT page's authentication boundary from its inventory hooks, preventing hook-order changes after login. Game inventories load independently. Remove misleading game-cosmetic action buttons that only displayed “coming soon”.
- Improve shared navigation active states/tap areas and InfoPopup phone bounds, focus trapping, Escape handling and focus restoration.

## Compatibility and boundaries

The existing GiftShopPopup open/onClose/accountId interface and GiftPopup players/senderIndex/onGiftSent callback shape are retained. Old per-game tiny-grid class overrides are intentionally superseded by the shared responsive dialog. Check representative game integrations before release.

Legacy receipt/notification icons are preserved in catalog data. New designs do not add bespoke game-specific gift animations or sounds; existing effects and sounds are retained where supported.

The purchase request still sends account IDs and a gift ID, never a client price. The server remains authoritative. The client latch is not server-side idempotency: atomic balance handling and network-retry protection still require backend review.

`bot/utils/nftService.js` can return a placeholder UUID when no external mint provider is configured. The UI therefore describes in-app collectibles and does not claim verified on-chain ownership, finite supply, rarity probabilities or a guaranteed token value. Confirm the real provider, metadata registration for new gift IDs and chain verification before marketing these as minted NFTs.

## Validation performed

- `node --test test/giftCatalog.node.mjs`: 14 passed, zero failures. Checks original pricing/IDs, unique definitions, shared server/client catalog, valid artwork coverage, filtering, authoritative-price request shape, duplicate submits and failures.
- TypeScript syntax transpilation of 16 changed JS/JSX/TSX source modules: no syntax errors. This is not a semantic type check or a production build.
- All 86 generated SVG documents parse as valid XML.
- Actual React 18.2 storefront preview with mocked API: 14 browser checks passed, no uncaught page errors. Widths: 320, 360, 390, 430, 768 and 1280 pixels. Checks include layout bounds, all 86 cards, filters, sorting, review without payment, one request for three immediate confirms, busy/Escape handling, persistent success/error, completion callback, modal focus restoration and reduced motion.
- Unavailable 3D-module fallback was tested. Actual Three.js/WebGL models were not rendered in this environment.

The preview is an independent HTML review artifact compiled from the implemented React storefront; its API is mocked and cannot spend real TPG. Browsing and mock checkout work offline. The optional 3D view loads the existing Three.js version from a CDN and requires internet access.

## Release checks still required

Run the full existing build/lint and navigation suites with the complete repository and dependencies. Verify the root-level shared catalog resolves in deployment. Check live account loading, inventory refresh, recipient validation, conversion amounts and errors, and the external mint provider. Visually inspect every model in a working WebGL browser and profile iOS/Android Telegram webviews. Check representative in-game gift dialogs and phone safe areas against the full application CSS. Complete the remaining site-wide authenticated/game audit separately.

Keep this change on a review branch until those checks and the proposed new prices are approved. No production deployment is implied by this document.
