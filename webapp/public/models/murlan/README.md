# Murlan Royale external character assets

Downloaded Sketchfab glTF folders are intentionally not committed to this repository because they contain binary buffers/textures.

The Murlan Royale inventory references these runtime-only Sketchfab glTF entry points:

| Character | Expected local file | Sketchfab model |
| --- | --- | --- |
| Agent 47 | `webapp/public/models/murlan/agent-47-rigged-face-morphs/scene.gltf` | <https://sketchfab.com/3d-models/agent-47-riggedface-morphs-1680cad927304bb687d6a9ad5b9dd98a> |
| Leather Jacket Portrait | `webapp/public/models/murlan/leather-jacket-portrait/scene.gltf` | <https://sketchfab.com/3d-models/leather-jacket-portrait-e4b6a08211c746fe932e0d5041d28812> |
| Seated Gentleman in Suede Jacket | `webapp/public/models/murlan/seated-gentleman-suede-jacket/scene.gltf` | <https://sketchfab.com/3d-models/seated-gentleman-in-suede-jacket-8b1101c090d4454caf9f311b3c008946> |
| Red Hibiscus in the Hair | `webapp/public/models/murlan/red-hibiscus-in-the-hair/scene.gltf` | <https://sketchfab.com/3d-models/red-hibiscus-in-the-hair-dc65f86920814a4296f930e7d85ab314> |
| Casual Confidence | `webapp/public/models/murlan/casual-confidence/scene.gltf` | <https://sketchfab.com/3d-models/casual-confidence-bff76010d9534241ae6c96a4a46a7959> |

Install every configured Sketchfab character with an authenticated download token. The installer resolves its default output paths from the `webapp` directory, so the same package scripts work consistently even if they are invoked from another current working directory.

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:murlan-characters
```

Install one character by asset id:

```bash
cd webapp
SKETCHFAB_TOKEN=<your-token> npm run fetch:murlan-characters -- --asset suede-gentleman
```

Install a manually downloaded Sketchfab glTF zip or extracted glTF folder:

```bash
cd webapp
npm run fetch:murlan-agent47 -- --from /path/to/agent-47-gltf.zip
npm run fetch:murlan-characters -- --asset casual-confidence --from /path/to/extracted-casual-confidence-gltf-folder
```

License notes from Sketchfab:

- Agent 47: CC BY-NC 4.0, attribution required, non-commercial use only.
- Leather Jacket Portrait, Seated Gentleman in Suede Jacket, Red Hibiscus in the Hair, and Casual Confidence: CC BY 4.0, attribution required.
