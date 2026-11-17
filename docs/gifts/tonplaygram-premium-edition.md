# TonPlayGram premium gift edition (draft)

## Artwork provenance and scope
Four original AI-generated studio illustrations were created for this change with OpenAI image generation: `royal_crown`, `speed_racer`, `surprise_box`, `victory_chalice`. No third-party reference art or downloaded samples were used. Prompt direction: premium TonPlayGram digital collectibles, titanium/obsidian surfaces, electric cyan crystals, fine gold edges, violet rim light, navy studio, TPG monogram; crown, racing kart, reward chest, esports trophy. No rarity, ownership or financial claims were requested.

Generated PNGs were inspected and resized to 640×640 WebP, quality 82. Each initial four-image file is under 50 KB; subsequent batches use an 80 KB ceiling per image. They are local lazy-loaded assets, not third-party URLs. Missing raster assets fall back to the original vector renderer. All remaining catalog designs use an updated ecosystem-themed SVG presentation. **Initial set: four images. Follow-up Originals batch adds eleven, bringing actual coverage to 15/86, including all fourteen Originals and Victory Chalice. The remaining 71 still use vector fallback, not premium raster remakes.**

## Checkout and game experience
- In-game catalog → explicit gift/recipient/TPG total confirmation → server-confirmed delivery → automatic return to game.
- Recipient can be changed on confirmation; missing/departed recipients disable sending.
- No price, gift ID, balance handling, minting or server behavior changes. Gift POSTs opt out of the generic network retry helper because this endpoint is not idempotent. Delivery is accepted only when the API receipt matches the gift, recipient, price, token and delivered status with a finite balance.
- Duplicate in-flight taps remain guarded; errors do not play success sounds or close the modal. Network failure is never automatically retried.
- Existing game gift callback shape retained. A 2.2-second pointer-events-none delivery receipt cannot intercept gameplay; reduced motion disables entrance effects.
- Brief original synthesized chimes respect existing game mute/volume. No network audio fetch and no multi-second playback delay. Audio initializes only from the confirmation gesture; unsupported/blocked audio is nonfatal.
- 3D is still optional in shop; the in-game path loads no viewer.

## Verification / release gate
Mocked API only: no real balances, gifts, minting or accounts changed during tests. Catalog/checkout node tests cover original IDs/prices, injection-safe SVG, local asset budget, duplicates, errors and ambiguous responses. UI tests cover explicit confirmation, recipient changes, duplicate taps, failure and departed recipients. Audio tests cover mute/volume, duration and unsupported devices.

Before release: review the four artwork designs; smoke-test iOS Safari/native and Android WebView for sound unlocking, existing game animation callbacks, narrow screens and reduced motion. Check checkout with a controlled test account/server. Server-side idempotency, nontransactional sender/receiver saves, receiver auto-creation and late network reconciliation remain separate pre-existing limitations; client duplicate guards are not server idempotency. No claim of full on-device QA or complete artwork rollout.

## Originals batch follow-up
Eleven new distinct generated illustrations complete the fourteen original gift IDs: Fireworks, Laugh Bomb, Pizza Slice, Coffee Boost, Baby Chick, Poop, Bullseye, Magic Trick, Dragon Burst, Rocket Blast, Alien Visit. Each depicts its own named subject, not a recolored duplicate. All were individually inspected for semantic clarity, matching navy/cyan/titanium/gold presentation, framing and legibility. Prompts and asset paths are recorded in `originals-artwork-prompts.json`. No pricing, financial, checkout, API or mint behavior changes are included in this artwork-only branch. Assets are 640px WebP, each under80KB, lazy-loaded through the existing renderer with vector fallback.
