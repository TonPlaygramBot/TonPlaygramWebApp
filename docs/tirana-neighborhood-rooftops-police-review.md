# Tirana Streets: neighborhood, rooftop access and police career

## Scope and player entry

- Neighborhood details are part of the existing shared city: Ura e Tabakëve, Petro Nini Luarasi, Njësia 2, Grand and Ali Demi. Existing mapped road and building outlines remain authoritative. The new detail layer adds nearby facade details to 333 mapped buildings and contributes 394 safely placed trees to the existing canopy system.
- Open Tirana Streets → Street Career → menu → **POLICIA**. Choose **SHQIPONJA**, **FNSH**, or **RENEA**. Each unit has three progressive operations, a unit vehicle, partner, uniform and loadout. Police progression and merit are local career data, separate from TPG balances. The normal career remains available after ending duty.
- Building access is in Street Career and its Free Roam. Eleven selected buildings have authored public interiors/access. Use the visible entrance action; selected institutions have physical switchback stairs, while Sky Tower and rooftop hotels/towers have elevator actions. Street exits and roof equipment use the same coordinates and heights as collision.
- Sky Club has an authored circular cafe with a rotating outer dining platform and stationary service core. The hidden sniper pickup is inside its fictional restroom. Roof kits provide a parachute and binoculars. Jump, then use **HAP PARASHUTËN**; use the movement stick to steer. Binoculars zoom the first-person camera and stop firing while active.
- Two rooftop helicopters are civilian and carry no missiles. Boarding checks actual rooftop height; exiting finds support on that roof. Existing ground aircraft and their flight missions remain available.
- Glass impacts produce anchored cracks and triangular shards; masonry gets chips and vehicles get exposed-metal scuffs. These are visual impact effects, not a general structural destruction or window-penetration system.

## Fidelity and performance boundaries

See `tirana-neighborhood-rooftops-sources.md` and `tirana-tabakeve-quarter.md` for sources. Bakery identity/placement and detailed individual facades are authored approximations, not a photogrammetric street survey. Only the existing mapped Mondial and Arka rooftop pools are represented; the research also verified Mercure, but this change does not add its footprint/pool. Access routes, interiors, police operations, helicopters, pickups and parachutes are game design. Arka's sixteen-metre depiction is explicitly an estimate from five storeys at 3.2 metres, not a measured height.

Architecture detail, trees and impact marks have distance/battery budgets. The neighborhood detail layer displays at most 36 nearby buildings (14 battery), with a bounded instance pool. No phone FPS claim has been measured in this session. Police mission actors are capped at six per operation. Real police procedure is not being simulated or represented as training.

The inline quarter review uses the actual new React/Three.js layer, existing map footprints and Blender window modules with a compact local context. It is a geometry review of the neighborhood, not the complete streamed game or a screenshot of production. `webapp/tirana-quarter-review.html` is the source review entry.

## Validation

Passed checks:

- Production Vite bundling of the webapp, including the real Tirana route.
- Focused TypeScript check: `tsc --noEmit -p webapp/tsconfig.tirana-gameplay.json`.
- Existing street-career, full-body, gameplay/presentation, mobile-combat, impact and flight regressions.
- New neighborhood tests for original footprints, named schools, tree spacing/clearance, both road/river sides, commercial frontage provenance and bridge profile.
- Original-GLB uniform tests for MakeHuman rig adaptation, first-person head masking, independent skeletons, lazy selection, retries and teardown.
- Access tests for all entrances/exits, supported roof kits, real switchback climbing, elevator round trip, height-gated equipment, steering/landing a parachute, rooftop helicopter boarding/egress and rotating cafe carry.
- Police tests for all three unit vehicles, actual target/range/LOS requirements, interruptible actions, live arrests/custody, damage attribution, resume, nine mission state machines and unique-completion merit.
- Four jsdom UI tests for unit/mission selection, lock/unlock and results, resume, and actual parachute/binocular action IDs.

Independent integration review found and fixed blocked exterior exits, unsupported kits, gaps at top stair exits, mismatched institution roof heights and Arka's untagged batched shell. The Sky sniper was picked up through the normal simulation action flow. All police objective positions were checked for an eligible collision-clear interaction point; this is not a proof of every complete traffic route.

The cloud browser could not reach either localhost or terminal.local (`ERR_BLOCKED_BY_CLIENT`). Full-game WebGL cutout appearance, final camera composition, touch layout on a physical phone and actual device performance therefore remain manual release checks. No production deployment or merge was performed.
