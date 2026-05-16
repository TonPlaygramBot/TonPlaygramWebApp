# Pool Table Traditional attribution

Pool Royale uses the authentic Sketchfab glTF for **Pool Table Traditional** by
**fizyman**. The model folder is intentionally not committed; install it locally
or in deployment with:

```bash
SKETCHFAB_TOKEN=<token> npm run fetch:pool-royale-traditional-table
```

A manually downloaded authentic Sketchfab glTF ZIP or extracted folder can also
be copied and validated with:

```bash
npm run fetch:pool-royale-traditional-table -- --from /path/to/pool-table-traditional-gltf.zip
npm run fetch:pool-royale-traditional-table -- --from /path/to/extracted-gltf-folder
```

- Source: https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977
- Author: https://sketchfab.com/fizyman
- Sketchfab model notes: 8 Foot Traditional style billiard table with mesh pockets; modeled in 3ds Max, textured and baked in Substance Painter.
- License shown on Sketchfab: Creative Commons Attribution (CC BY 4.0)
- License URL: https://creativecommons.org/licenses/by/4.0/

The downloaded glTF keeps the original table shape, UV mapping, material slots,
external `.bin`, and baked texture payload. Pool Royale then fits that authentic
model to the game playfield and can remap selected material roles for
user-customized table finishes.
