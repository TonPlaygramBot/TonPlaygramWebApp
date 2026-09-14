# Showood 7 ft table GLB

Pool Royale uses only the Showood 7 ft GLB table and expects the fastest same-origin copy at this runtime path:

```text
webapp/public/models/pool-royale/showood-seven-foot/seven_foot_showood.glb
```

The `.glb` binary is intentionally not committed. Install it during deployment or local setup with:

```bash
npm run fetch:pool-royale-showood-table
```

If the local file is not present, the app still tries the public Pooltool CDN/raw Showood GLB URLs configured in `src/config/poolRoyaleTableModels.js`; it no longer falls back to the old procedural table.
