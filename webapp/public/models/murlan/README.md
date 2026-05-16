# Murlan Royale external character assets

Binary character models are intentionally not committed to this repository.

## Agent 47 rigged Sketchfab character

The Murlan Royale inventory expects this runtime-only file:

```text
webapp/public/models/murlan/agent-47-rigged-face-morphs.glb
```

Install it from Sketchfab with an authenticated download token:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:murlan-agent47
```

Or copy a manually downloaded GLB into the expected location:

```bash
cd webapp
npm run fetch:murlan-agent47 -- --from /path/to/agent-47-rigged-face-morphs.glb
```

Source model: <https://sketchfab.com/3d-models/agent-47-riggedface-morphs-1680cad927304bb687d6a9ad5b9dd98a>

License noted on Sketchfab: CC BY-NC 4.0, attribution required, non-commercial use only.
