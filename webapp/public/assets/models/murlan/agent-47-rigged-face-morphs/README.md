# Murlan Royale Agent 47 runtime asset staging

The Murlan Royale character catalog references this folder so the Agent 47 character can be used in the game without committing Sketchfab binary assets to the pull request.

## Source

- Sketchfab page: <https://sketchfab.com/3d-models/agent-47-riggedface-morphs-1680cad927304bb687d6a9ad5b9dd98a>
- Creator: Veterock (`@windofglass`)
- License shown by Sketchfab: Creative Commons Attribution-NonCommercial 4.0
- Notes from the source page: the model is described as a ripped Agent 47 model and credits IO Interactive ownership; verify legal/commercial approval before shipping.

## Deployment-only files

Download/export the Sketchfab model outside git and place one of these runtime entry files here:

- `scene.gltf` plus its generated `scene.bin`, `textures/`, and any other exported sidecar files; or
- `scene.glb` as a single binary GLB.

The repository `.gitignore` intentionally ignores everything in this folder except this README and `asset-manifest.json`, so those large/binary files stay out of PRs while the app can still load them when present in the deployed static assets.
