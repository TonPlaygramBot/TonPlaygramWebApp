# Twenty new Tirana race routes

The catalogue offers only twenty genuinely different closed-event courses on the checked-in city street graph. Farkë, Surrel and Liqeni are no longer selections. All nine previous circuit identifiers migrate to new circuits through trackMigration.mjs, displaying the actual replacement name. This is not a claim that the rural locations moved into central Tirana.

## Source and constraints

`scripts/build-racing-urban-routes.mjs` deterministically authors graph faces and selected adjacent-face unions. Every boundary segment, including the closing segment, must exist in the unchanged city road graph. No invented connecting roads, enlarged source widths, moved buildings or collision exceptions admit a course. Route names use streets on the actual boundary, not streets enclosed inside a loop.

The roads retain the existing OpenStreetMap contributors / ODbL attribution. Width values are the game's existing source-derived road model, not surveyed measurements. Official city reference for neighborhood/street-name cross-checking: https://tirana.al/uploads/2024/8/20240822152425_2024_08_pocket-map-web-2.pdf . This reference does not establish race permissions, current road works or exact current building appearance.

The twenty additions are compact technical kart courses rather than repetitions of the long boulevard routes. Their source lengths range approximately 583–1662 metres. The six previous broad-road events are also retired from selection; their geometry is retained only as archived authoring/regression evidence. An offline pairwise check rejects any new route sharing over 70% of the shorter course with another new course or one of the six existing courses; reverse/rotation duplicates are also rejected.

The racing world now reuses the exact shared city snapshot. Archived rural datasets remain in the repository but are not imported by race catalogue/scenery. Free-driving UI removal and new career progression are separate integration work.

## Verification

Automated checks cover exact source edges, closed unique junction sequences, boundary ribbons inside the source asphalt, building clearance, minimum usable width, twelve-kart starting positions and body separation, and AI lap completion. Technical streets can be narrower than the eight-metre boulevard-grid design target: their adaptive two-column grid is checked using actual kart body width plus outside margin rather than pretending all streets are boulevards.

These are deterministic headless simulations and geometry checks, not an interactive driving or visual-quality sign-off. Browser/GPU driving, controller feel and rendered landmark likeness still require a supported graphical environment. No deployment is part of this route patch.

## Final route audit

| ID | Boundary streets | Race length (m) | Minimum usable width (m) | Grid minimum (m) |
|---|---|---:|---:|---:|
| tirana-prokop-mima | Rruga Kodra e Diellit, Rruga Liman Kaba, Rruga Muharrem Butka, Rruga Prokop Mima | 582 | 5.67 | 5.89 |
| tirana-myslym-shyri | Bulevardi Gjergj Fishta, Rruga Dëshmorët e 4 Shkurtit, Rruga Myslym Shyri, Rruga Sami Frashëri | 1154 | 5.89 | 8.84 |
| tirana-sulejman-delvina | Bulevardi Bajram Curri, Bulevardi Gjergj Fishta, Rruga Muhamet Gjollesha, Rruga Sami Frashëri, Rruga Sulejman Delvina | 1457 | 5.89 | 9.30 |
| tirana-kavaja-center | Rruga Dedë Gjo Luli, Rruga Dëshmorët e 4 Shkurtit, Rruga e Kavajës | 1469 | 5.89 | 6.20 |
| tirana-zogu-pare | Bulevardi Zogu i Parë | 677 | 5.43 | 5.89 |
| tirana-gurakuqi | Rruga Ismail Ndroqi, Rruga Luigj Gurakuqi, Rruga e Dibrës | 655 | 5.85 | 11.78 |
| tirana-riza-abazi | Rruga Dhimitër Mihali, Rruga Malsoreve, Rruga Riza Abazi, Rruga Turdive | 646 | 5.89 | 5.89 |
| tirana-sadik-petrela | Bulevardi Zhan d'Ark, Rruga Odhise Grillo, Rruga Sadik Petrela, Rruga Selman Riza | 586 | 5.89 | 5.89 |
| tirana-marie-kraja | Rruga Ilia Shyti, Rruga Leandro Zoto, Rruga Marie Kraja, Rruga Violeta Manushi | 1053 | 5.89 | 5.89 |
| tirana-nesheraku | Bulevardi Bajram Curri, Bulevardi Gjergj Fishta, Rruga Isuf Elezi, Rruga Muhedin Llagani, Rruga e Kavajës, Ura e Nesherakut | 1462 | 5.89 | 5.89 |
| tirana-kavaja-gjollesha | Rruga Muhamet Gjollesha, Rruga e Kavajës | 1101 | 5.89 | 5.89 |
| tirana-gjollesha-lana | Bulevardi Bajram Curri, Bulevardi Gjergj Fishta, Rruga Isuf Elezi, Rruga Muhamet Gjollesha, Rruga Muhedin Llagani, Rruga Sulejman Delvina, Ura e Nesherakut | 1154 | 5.89 | 5.89 |
| tirana-kastriot-feska | Bulevardi Bajram Curri, Bulevardi Zhan d'Ark, Rruga Kastriot Feska, Rruga Nazmi Rushiti | 1309 | 5.89 | 5.89 |
| tirana-brryli | Bulevardi Bajram Curri, Bulevardi Zhan d'Ark, Rruga Norbert Jokl, Ura te Brryli | 1312 | 5.89 | 5.89 |
| tirana-andrea-kushi | Rruga Andrea Kushi, Rruga Falcone - Borsellino | 816 | 5.89 | 5.89 |
| tirana-shqiponja | Rruga Dritan Hoxha, Rruga Lord Bajroni, Sheshi Shiqponja | 1143 | 5.89 | 5.89 |
| tirana-riglata | Rruga Riglata, Rruga Turhan Pashë Përmeti | 1661 | 5.89 | 5.89 |
| tirana-pese-maji | Rruga 5 Maji, Rruga Selaudin Bekteshi | 635 | 5.52 | 5.88 |
| tirana-vangjel-noti | Rruga Agim Hysenbelliu, Rruga Gjergj Legisi, Rruga Muharrem Bajraktari, Rruga Vangjel Noti | 820 | 5.78 | 5.89 |
| tirana-don-bosko | Rruga Asllan Shahini, Rruga Dom Mark Dushi, Rruga Don Bosko, Rruga Eshref Frashëri | 939 | 5.89 | 6.20 |

## Test scope changes

Old tests requiring selectable rural circuits were replaced with explicit retirement/migration assertions. The archived six boulevard test fixtures still require at least four safe event humps and a corner-approach hump. Short technical courses do not inherit that fixed obstacle count: existing placement rejects unsafe positions near boost pads and turns instead of forcing extra obstacles to satisfy a long-course fixture.

## Twenty-only follow-up

The selectable runtime catalogue contains exactly the twenty new routes; none of the six old urban circuits remains a selectable entry. `trackMigration.mjs` maps both the old urban/rural IDs and the five ancient theme aliases directly to canonical new IDs. Unknown IDs still fail instead of silently selecting a different track. The default is the first new course and cup metadata uses canonical IDs. The lobby must initialize and normalize selection against this new catalogue (included by the UI integration).

Historical boulevard length, grid-width, hump-count and seven-pad requirements are retained in an explicitly test-only archived catalogue. Current twenty-route tests independently verify their actual source edges, physical widths, obstacle-safe placement and full AI races, without misrepresenting compact technical courses as long boulevards.
