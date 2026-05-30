# Showood 7 ft table GLB

Pool Royale expects the Showood 7 ft GLB at this runtime path:

```text
webapp/public/models/pool-royale/showood-seven-foot/seven_foot_showood.glb
```

The `.glb` binary is intentionally not committed. Install it during deployment or local setup with:

```bash
npm run fetch:pool-royale-showood-table
```

If the local file is not present, the app falls back at runtime to the public Pooltool CDN/raw URLs configured in `src/config/poolRoyaleTableModels.js`.
