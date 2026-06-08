# Traditional 8 ft table GLB

Pool Royale expects the runtime table-only GLB at:

```text
webapp/public/models/pool-royale/traditional-fizyman-eight-foot/pool_table_traditional.glb
```

The `.glb` binary is intentionally not committed. Install it from the downloaded Sketchfab source file with:

```bash
npm run fetch:pool-royale-traditional-table -- /path/to/pool_table_traditional.glb
```

If no path is provided, the script tries:

```text
~/Downloads/pool_table_traditional.glb
```

The installer keeps the source table node and removes the included cue, balls, and ceiling light from the runtime scene so Pool Royale can provide the live match objects.

Attribution: "Pool Table Traditional" by fizyman, licensed under CC-BY-4.0.
Source: https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977
