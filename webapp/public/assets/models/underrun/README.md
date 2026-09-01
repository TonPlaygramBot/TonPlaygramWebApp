# Underrun Arena model and map sources

## Human avatar

Underrun Arena loads the Ready Player Me sample avatar already referenced by the
Chess Battle Royal inventory. The model stays remotely hosted, so this change
does not add binary model files. A procedural officer is shown while it loads or
when the player is offline.

Source: <https://threejs.org/examples/models/gltf/readyplayer.me.glb>

## Tirana reference

The arena placement uses the OpenStreetMap entry for **Kuvendi i Shqipërisë**
(way `256162012`), centered at `41.3259852, 19.8230480`. The building footprint,
front steps, Albanian flag, neighboring street walls, trees, and road placement
are an optimized artistic reconstruction for portrait mobile play rather than a
survey-grade model.

Map data © OpenStreetMap contributors, ODbL 1.0:
<https://www.openstreetmap.org/way/256162012>

## City generator

The asphalt, pavement, façade textures, road grid, lane markings, crossings,
towers, and trees are a typed React Three Fiber port of the original
`examples/tirana-2040.html` city generator in this repository.
