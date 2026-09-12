# Tirana Streets suited agent and starter knife

Both source models are CC0. Brand artwork elsewhere in the game is not CC0.

- **Quaternius, Ultimate Modular Men / Suit**: [creator's pack and license](https://quaternius.com/packs/ultimatemodularcharacters.html), [original glTF in the creator-linked public folder](https://drive.google.com/file/d/1NhXHnGU0zK9hBrT5FoZp8nTz_EmvTPg5/view). The unmodified embedded glTF is archived as `suit-original.gltf.gz`. The builder removes the separate handgun and hair primitive, preserves the complete scalp, recolors the suit/shirt/tie, and retains the Idle, Walk and Run clips. All 24 source clips remain in the archive. This is a suited-agent interpretation, not a licensed Hitman/IO Interactive model.
- **Vinrax, Knife Low-poly**: [creator's page and CC0 license](https://opengameart.org/content/knife-low-poly), [source archive](https://opengameart.org/sites/default/files/knife_0.zip). The original OBJ is archived in `knife/knife.obj.gz`; `diffuse.jpg` is the source color texture resized to 512 px. The builder converts the coordinate axes and sets the complete model length to 0.30 m. It retains all 1,176 source triangles.

From the repository root, run:

```sh
python webapp/scripts/build-tirana-agent.py
python webapp/scripts/build-tirana-knife.py
```

Both builds are deterministic and require only the Python standard library. Outputs are local GLBs; gameplay makes no requests to source websites.
