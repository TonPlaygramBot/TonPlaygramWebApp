# Murlan Royale Character Realism Pipeline

This implementation treats Murlan Royale humans as close-camera portrait characters rather than simple board-game tokens.

## Material research applied

- **NVIDIA DLSS / RTX Kit direction**: the web build cannot load native DLSS DLLs, but it follows the same visual goals: stable high-frequency detail, sharper material reconstruction, better temporal clarity, and texture-memory discipline. Current NVIDIA public material focuses on DLSS 4/RTX Kit rather than a web-usable “DLSS 5” SDK.
- **Open PBR sources**: Poly Haven-style CC0 material sets are used as the primary texture source, while the pipeline is structured so AmbientCG/CGBookcase texture URLs can be added as new `materialTextureSet` entries without changing character rig code.
- **Original GLTF/GLB mappings**: original avatar UVs are preserved. Existing GLTF base color maps stay in place; the enhancement pass adds missing normal, roughness, bump, clearcoat, sheen, and micro-detail maps.

## Character styling direction

- Each character receives a `royalStyle` profile for makeup intensity, age detail, trim level, and metal tone.
- Outfit combos now support separate upper garment, lower garment, accent, shoes, and trim slots.
- Skin materials get pores, subtle freckle noise, blush, age-line detail, roughness variation, and subsurface-inspired physical material tuning.
- Hair, beard, mustache, and brows share the same hair tone and receive fine strand micro maps.
- Eyes use low roughness, high environment response, and clearcoat when available for wet-eye reflections.
- Royal trim and generated buttons use metallic material values, not flat fabric values.

## Mobile performance choices

- Texture additions are cached in `MURLAN_CHARACTER_TEXTURE_CACHE`.
- Generated detail maps are small procedural canvases, so the game gains close-up detail without bundling large new assets.
- Renderer settings keep ACES tone mapping, sRGB output, soft shadows, and anisotropic texture filtering while preserving the existing frame-quality profiles.
