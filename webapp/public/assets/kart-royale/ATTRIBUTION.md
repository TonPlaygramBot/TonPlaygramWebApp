# Kart Royale assets

The Apex kart meshes are original TonPlaygram geometry adapted from the chassis,
tire, seat and driver component approach in `src/components/WeaponKartGame.jsx`.
`scripts/build-kart-royale-assets.mjs` exports both detail levels to local GLB.
No external model URL or decoder is needed at runtime.

Engine audio reuses `/assets/sounds/race-care-151963.mp3`, already shipped by
TonPlaygram. Its original provenance is unchanged. Track surfaces and curbs
adapt WeaponKart's track construction using shared and instanced geometry.
