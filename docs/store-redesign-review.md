# Store redesign — integration review

This draft integrates the mobile-first redesign previously prepared as a source package. It is not a production-readiness claim. No payment or deployment was performed.

## Changes

- Replace the store entry point with modular React + TypeScript components. Add portrait two-column cards, search, game/category filters, sorting, collection view, item details and explicit basket review.
- Keep existing item IDs, catalog prices, the previous global price transform, payment endpoint and inventory adapters. Do not change backend routes, wallet addresses or dependencies.
- Preserve the previous `Store.jsx` byte-for-byte as `StoreLegacy.jsx`; creator/custom-HDRI tools remain accessible through the new footer and `?view=creator`.
- Prefer actual item images. Replace only the known generic swatch template; keep genuine SVG item art. Missing/broken images fall back to type-specific SVG illustrations using supplied catalog colors. Without colors, show a neutral shape illustration. The runtime generator covers the catalog types without requiring a separate image file for every item.
- Provide an optional, lazy Three.js illustrative material viewer in one item dialog, not a WebGL canvas on every card.
- Explain the item appearance, supported game, effect and consumable/customization distinction. Do not display fabricated rarity, scarcity, mint dates or sales history in the new official store.

Generated illustrations are not verified captures of the exact in-game models. They are labeled Illustration or Shape preview. Exact character, table, texture and environment captures still require an asset-by-asset rendering pass. Existing remote image URLs have not all been audited.

## Reviewed base

Base commit: `3c5ac8c5df45f07865d37ce7dc5833ef3142a2f7`.
Original store blob: `06e63dbadb311f6cfe90cf11c44694993807bf5a`.
The legacy page reuses that exact Git blob.

## Tests

Run after installing the repository's normal webapp dependencies:

```sh
node --test tests/store-redesign.test.cjs
```

The 16 logic/artwork tests passed in the prepared package and were rerun successfully while preparing this PR. They cover price scaling, cent-precision totals, filters, sorting, entitlement deduplication, descriptions, image-source validation, palette extraction and SVG generation. The package's standalone 16-item sample previously passed 24 browser checks, including portrait widths, basket interactions and image fallbacks. Those sample checks are not an integrated application build or authenticated checkout test.

## Required before merge/release

- Run the full webapp build, type checking/lint and repository navigation tests in the normal dependency environment.
- Test the integrated `/store/all` and per-game routes, creator view, account switching and inventory refresh in staging and in portrait Telegram WebViews.
- Exercise authenticated TPG checkout, insufficient balance, lost responses, delayed inventory sync and repeat training-attempt purchases without double charging.
- Verify the lazy WebGL viewer on actual supported devices, including loss of WebGL context and offline fallback.
- Audit remote thumbnail failures and replace illustrative placeholders with exact asset captures where required.

The existing backend trusts submitted item prices, does not expose a purchase idempotency key, and explicitly persists delivery for only selected game scopes. These are existing integration/release review items, not backend fixes delivered by this UI PR. A client-side click lock does not replace server-side idempotency. Keep uncertain payment results from inviting a second charge; reconcile wallet and inventory first.

The complete repository build, authenticated checkout, native Telegram WebView behavior and exact GLB/HDRI rendering have not been verified in this environment. This PR remains draft until those checks are completed.

## Rollback

Restore `StoreLegacy.jsx` to `Store.jsx`, then remove only the new redesign files introduced by this PR. The preserved page is unchanged from the reviewed base. No backend migration or catalog reversion is required.
