# Humanoid motion curves

The adjacent `humanoidMotions.mjs` contains resampled joint positions from
**Quaternius Universal Animation Library Standard v3**, distributed by Quaternius
under **CC0 1.0 Universal**. Downloaded from the creator's standard free package
on 14 September 2026, not the paid Pro package.

- Creator and source: https://quaternius.itch.io/universal-animation-library
- Creator's catalog: https://quaternius.com/packs/universalanimationlibrary.html
- License: https://creativecommons.org/publicdomain/zero/1.0/

Source SHA-256 and source clip names are included with the data. Rebuild with
`webapp/scripts/sample-tirana-humanoid-motions.mjs` and the original in-place
`Unreal-Godot/UAL1_Standard.glb` from the Standard v3 archive.

Ten source clips supply walking, jogging, sprinting, idle, crouching, two hit
reactions and two punches. The game retains each existing character's original
geometry, skin weights, materials and rig. These curves drive per-rig inverse
kinematics; skeleton rotations are never copied between incompatible rigs.

CC0 applies to these motion samples only. Existing Ready Player Me, Mixamo and
Albanian Forces geometry and textures retain their separately documented terms.
