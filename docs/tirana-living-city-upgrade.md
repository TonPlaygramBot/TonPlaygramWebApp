# Tirana Streets: city events and character presentation

This change updates the existing solo Street Career game and the shared city renderer. It adds a fictional rally in Skanderbeg Square, distinguishes the five police units, and improves the lighting and material handling of the original textured humans. It does not replace the city map or claim a photogrammetry rebuild.

## Player experience

- Free roam starts a nearby rally with gathering, chanting, a short unrest phase, de-escalation and dispersal. The event has at most 36 civilians and 14 officers, a four-minute lifetime and a six-minute cooldown. Blocked or occupied spawn positions are skipped.
- Most bystanders retreat when unrest begins; a small minority remains to gesture. Fireworks and smoke use the existing bounded particle pools. Their visuals do not inflict damage or award money. Attending the rally is not a crime.
- Police receive timestamped, expiring orders. Patrol officers communicate, traffic officers direct incoming vehicles, Shqiponja patrols the perimeter, FNSH maintains a cordon, and RENEA waits in reserve. During dispersal they receive withdrawal orders. Event officers are unarmed; existing law-enforcement systems handle player offenses.
- Incoming road traffic brakes outside the square and prefers alternate road edges. Cars already inside can leave. Closures end when dispersal begins.
- The journal shows the event report and its map location. Settings can disable city protests immediately and persist that preference. Removing an event removes only its owned actors.
- The connected multiplayer engine does not automatically opt into the solo event. Existing pursuit behaviour now uses different movement, spacing, search duration and flanking profiles for each force unit; these are arcade gameplay choices, not operational instructions.

## Graphics and animation

- Uses the existing original uniform and civilian GLBs with their original texture maps. Police now receive the same color-space and skin-material treatment as civilians. Materials are prepared once per source, shared by clones and released after the actors.
- Civilian chant gestures and officer communication/cordon/traffic gestures are layered onto the actual skeletons. Locomotion remains driven by measured displacement and the original animations where available.
- Replaces studio reflections with a locally served 1K outdoor HDRI through PMREM. The city's mapped buildings and dynamic sky remain the visible scene, and existing day/night/weather exposure still applies.
- Human and force loaders support local Draco, Basis/KTX2 and Meshopt decoding, with bounded worker pools. Existing character LOD, animation distance limits and graphics presets remain active.
- Ordinary civilian labels are hidden; shopkeeper labels remain available. Emergency vehicle lights depend on response status instead of flashing continuously on every patrol.

The new original asset is **Urban Street 04**, by Andreas Mischok, published by Poly Haven under CC0. It is used only for reflection lighting, not as a depiction of Tirana. The adjacent `outdoor-lighting-source.json` records its URL, SHA-256 and byte size.

- Asset: https://polyhaven.com/a/urban_street_04
- License: https://polyhaven.com/license

## Portrait review

`webapp/tirana-city-event-review.html` loads the actual React, Three.js and TypeScript city renderer and solo simulation. It opens at player eye level near the event. Drag to look, change the event phase, pause, and compare Battery/Balanced/High graphics. It is included in the Vite production entries.

Run the webapp Vite development server and open `/tirana-city-event-review.html`. Review at 390×844 and 320×740 as well as on an actual phone. The review is a scene inspection surface, not the complete game controls or a standalone substitute for the game.

## Research context

Contemporary reports were used only as broad context for crowd gathering, cordons, fireworks and dispersal. No identifiable real person, injury, political slogan, or specific confrontation has been reconstructed.

- RTSH, 7 November 2026: https://rtsh.al/rti/en/two-protests-held-in-tirana-as-demonstrators-clash-with-police/
- RTSH, 24 October 2026: https://rtsh.al/rti/en/clashes-spread-across-tirana-as-protesters-attack-police-and-public-buildings/

## Validation

See `docs/validation/tirana-living-city.md` for executed checks and remaining limitations. Browser screenshots, device FPS and visual quality must not be inferred from passing headless rig tests.
