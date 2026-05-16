# Murlan Royale external character assets

Binary character models are intentionally not committed to this repository.

The Murlan Royale inventory expects these runtime-only files:

```text
webapp/public/models/murlan/agent-47-rigged-face-morphs.glb
webapp/public/models/murlan/leather-jacket-portrait.glb
webapp/public/models/murlan/seated-gentleman-suede-jacket.glb
webapp/public/models/murlan/red-hibiscus-in-the-hair.glb
webapp/public/models/murlan/casual-confidence.glb
```

Install all supported Sketchfab characters with an authenticated download token:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:murlan-characters
```

Install only Agent 47:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:murlan-agent47
```

Or copy manually downloaded GLBs into the expected filenames:

```bash
cd webapp
npm run fetch:murlan-characters -- --from-dir /path/to/downloaded-glbs
npm run fetch:murlan-characters -- --character casual-confidence --from /path/to/casual-confidence.glb
```

Sources:

- Agent 47: <https://sketchfab.com/3d-models/agent-47-riggedface-morphs-1680cad927304bb687d6a9ad5b9dd98a>
- Leather Jacket Portrait: <https://sketchfab.com/3d-models/leather-jacket-portrait-e4b6a08211c746fe932e0d5041d28812>
- Seated Gentleman in Suede Jacket: <https://sketchfab.com/3d-models/seated-gentleman-in-suede-jacket-8b1101c090d4454caf9f311b3c008946>
- Red Hibiscus in the Hair: <https://sketchfab.com/3d-models/red-hibiscus-in-the-hair-dc65f86920814a4296f930e7d85ab314>
- Casual Confidence: <https://sketchfab.com/3d-models/casual-confidence-bff76010d9534241ae6c96a4a46a7959>

License notes from Sketchfab at integration time:

- Agent 47: CC BY-NC 4.0, attribution required, non-commercial use only.
- Restore50 characters: CC Attribution, attribution required.
