# Tirana Streets: Blood, Loyalty & Power

Tirana Streets is a mobile-first single-player action adventure set in a fictionalized Tirana. Turi returns from Rinas and follows a message from Dreni, his missing childhood friend. The clues uncover connections among fictional business figures, rivals, and corrupt officials. The real city provides its identity; the characters, organizations and incidents are invented.

## Development order

| Milestone | Deliverable | Release gate |
| --- | --- | --- |
| 1. Rikthimi | Opt-in story opening: message, two vehicle objectives, a two-way decision and local resume. One short cinematic rendered from the original Turi model. | Fresh/returning run on portrait touch, readable UI, both choices and reload, no existing save/account mutations. |
| 2. Chapter 1 | Five distinct missions across driving, investigation, dialogue and a fictional arcade pursuit. Add a shared mission journal, checkpoints and a reconnect/retry path. | Full first chapter playable, save versioning, accessibility, no disruption to Explore. |
| 3. Systems chapter | Day/night free-roam incidents, distinct fictional faction relationships and graduated police response. Vehicles, arrest and reputation affect story outcomes; economy has no real-currency dependency. | Replayable incident benchmarks, no mission collisions, outcome tests, verified state persistence. |
| 4. Campaign | Ten chapters; 50 missions with a declared runtime readiness state, three endings, and post-finale Free Roam consequences. | Each playable mission and both branches tested, recoverable checkpoint failures, ending and post-finale state tested. |
| 5. Online | First a measured 2–4-player Co-op Operations prototype in a controlled environment. Evaluate the other modes later. | Authoritative shared state, disconnect/rejoin, controls, accessibility and measured concurrency. No capacity claims before load tests. |

## Gameplay direction

Loop: receive a lead → choose how to pursue it → explore or drive → confront a setback → make a decision → see its effect on allies, factions and subsequent leads. Treat the requested 35% action / 25% driving / 15% story / 15% exploration / 10% economy as design pacing targets, not measurements. Never require a purchase or property grind to discover core clues or reach an ending. Maintain Explore and the original Turi; do not reuse third-party screenshots as shipped assets.

Keep danger fictional and mechanics game-like. In open-world testing validate non-armed warning/surrender, bounded escalation and de-escalation, and the absence of a new lethal response. Use invented opponents and fictional sites for staged action. The three endings should change the player’s relationship with each faction; they should not block free exploration.

Online scope from the proposal: Gang Wars 8v8, Police vs Outlaws 4v4, City Battle Royale 32, Co-op Operations 2–4, Team Deathmatch 5v5, Convoy 4v4, Street Racing 2–8 and Open World 16–32. These are not implemented features or measured capacities. The current restored user entry explicitly disables online matches; none of these modes should be advertised as playable in its UI.

## Test this draft locally

From an active development instance, visit `/games/tiranastreets?storyPreview=ch01-return` and choose Turi if prompted. Open Dreni's message, enter a vehicle, follow both checkpoints and choose whether to call back or read the note. Reopen the same route to check the choice. Regular Career does not use the preview save. The preview uses existing city checkpoints; it is not a recreation of the airport. No shop, wallet, or account interaction is required. The ambient incident controller has no game caller or HUD in this draft.

Tests: `node --test test/tiranaStoryReturnPreview.test.mjs test/tiranaStoryCampaignCatalog.test.cjs test/storyAmbientPreview.test.mjs` after installing the web app dependencies.
