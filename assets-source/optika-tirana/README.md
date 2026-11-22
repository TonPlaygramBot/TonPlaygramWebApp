# Tirana Streets · civic 3D preview

Isolated, browser-playable prototype of central Tirana, with the original Turi
character, 3P/FPV cameras, portrait touch movement, and a three-stop civic trail.
There are no accounts, wagers, weapons, unit tactics, or network game services.
This does not replace live Optika, restore a retired route, or change Racing.

## Serve the production build

The Games card opens `/assets/optika-tirana-v1/index.html`. Serve this path on the TonPlayGram origin. It references the
existing same-origin `/assets/tirana-streets/players/turi.glb` and does not
include a duplicate. For a local-only copy of the existing project asset, put
those exact bytes at `webapp/public/assets/tirana-streets/players/turi.glb` before opening.
The asset must have SHA-256
`15aa91bb5206589087df60e47911f3b64ec1d95b4e380a685b3b025f21446f02`
and clips Idle/Walk/Run; missing or incompatible models fail visibly.

Touch arrow pad moves Turi, drag the scene to turn/pitch, use the camera
button to switch view, and tap Konfirmo inside each marked circle.
Desktop: WASD/arrow keys, Shift to run, E to confirm. Works as a standalone HTML
entry; do not open as `file://`.

## Development

Install the webapp's locked dependencies first. Recreate the static bundle in a scratch directory with `cd assets-source/optika-tirana && ../../webapp/node_modules/.bin/vite build`. Copy the new hashed JS and CSS and the built index to the versioned directory while keeping the generated GLBs, geometry JSON, cover and notices there. Recreate the public static geometry and drone directly from the retained source with `node build-map.mjs` and `node build-survey-drone.mjs`. Run `node --test *.test.mjs`. The generated public geometry is ODbL; see the visible attribution and `webapp/public/assets/optika-tirana-v1/assets/data-license.txt`. The map is clipped to the old city center and
is not a survey-grade or full-city reconstruction.

Verification: Vite production build, 12 Node tests, and CPU GLTFLoader parse of
both model files with image decode stubbed. Physical phone/input/GPU test
remains; headless Chromium was blocked by the execution sandbox.

## Ushtrimi i dronit të shpëtimit

Tap **Fluturo me dron** for free flight, with the movement pad and altitude **+/−**
(keyboard WASD and R/F), and switch 3P/FPV using the camera button. For the optional mission, tap **Ushtrim shpëtimi** first and find the
orange disabled service van; **Shëno furgonin** then **Njofto shpëtimin**
completes the simulated dispatch. **Kthehu te Turi** resumes the civic walk.
No real rescue service receives anything. The original project rescue drone is
a separate local GLB with four named rotor nodes, animated independently at
runtime. No fallback to a different model is used if the drone fails to load.

**Pika ajrore** is a separate optional timed challenge in the same central
Tirana tile. The clock advances only while the aerial challenge is selected;
fly through the three rings in order. The original on-foot trail and the
optional rescue exercise keep independent progress.
