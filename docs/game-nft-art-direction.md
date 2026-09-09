# TonPlaygram — premium game NFT art replacement

Status: ART BRIEF ONLY — no generated images are included in this revision.
Date: 2026-09-09
PR: https://github.com/TonPlaygramBot/TonPlaygramWebApp/pull/25789

## User-requested correction

Replace the generic gift art direction in this draft PR with premium collectibles about the games actually displayed on the Games page. Generate the finished artwork using the latest ChatGPT image creation, not emoji, hand-coded SVG motifs, repainted stock icons, or a claim that procedural Three.js geometry is generated artwork.

The previous generic collection and HTML preview are not the approved final artwork. This document supersedes their ART DIRECTION only; it does not claim that the storefront, catalog, preview, or assets have already been replaced.

The Games page imports `webapp/src/config/gamesCatalog.js`. That list currently contains the 17 games below. `gameAssets.js` and App routes contain additional keys, but a route or thumbnail alone does not establish membership of the visible Games page. Do not add BLACK TIDE, shooting range, 2048, Hextris, or other unlisted games to this collection without a subsequent Games-page change.

Source snapshot: gamesCatalog blob `14df98117f3a6451af3c2fefae9d000dbe6c6157`; Games.jsx blob `e19a9bcf3c36dda510be138c29d8d377629d0453`.

## Image-generation target and execution boundary

OpenAI announced ChatGPT Images 2.5 on September 8, 2026. Use that current ChatGPT Images experience for final generation. The announcement also describes GPT-Image-2.5 Sunburst as its premium visual-workflow API offering; this is not permission to assume an API model identifier, available credentials, or paid API execution.

Official sources:
- https://openai.com/index/introducing-chatgpt-images-2-5/
- https://help.openai.com/en/articles/6825453-chatgpt-release-notes

No image-generation tool was available in the session that prepared this brief. No Images 2.5 requests were executed, no new image files were created, and no generation or visual approval is claimed. Keep the PR draft until actual artwork and the integration below are complete.

## Art direction

Make these look like high-end physical gaming collectibles photographed for a luxury product campaign: tactile graphite and obsidian, selective brushed platinum or champagne-gold hardware, enamel accents, readable glass, authentic cloth, carbon fiber and polished resin. Use the real game palette as an accent, not a rainbow of unrelated themes.

Use a coherent studio: near-black midnight background, soft warm key light visually from the upper left, restrained cyan rim light visually from the right, grounded contact shadows and controlled reflections. Dark objects must remain clearly separated from the background. No excessive bloom, overexposure, floating confetti, cheap toy-plastic finish, clip art, sticker borders, arbitrary crowns on everything, or generic mascots.

Create recognizable game objects and selective compact arena dioramas. The 86 subjects below are independent compositions, not one icon multiplied through five color swaps. Prefer simple silhouettes and no more than three principal objects in one composition; a board or arena can serve as one coherent principal object.

Compose each master square, the entire collectible visible and centered with a safe margin around it. Render the hero at approximately 70–80% of the image height, large and legible in the phone's two-column cards. Keep a consistent gently elevated three-quarter view. The user's directions refer to the screen: up is visually higher, right is visually right, closer means appears larger. Never reinterpret those directions as internal model axes.

Keep names, TPG prices, ownership, tier labels and interface text out of the generated image; render them as crisp HTML. Intentional details intrinsic to a game prop, such as the 8 on an eight-ball or card ranks, must be checked manually. Never invent branded sponsors, token values, guaranteed rarity, edition sizes, winnings, benefits or on-chain proof.

## Master generation instruction

Use this with one subject below, its game name, and supplied reference screenshots. Replace the bracketed fields before generation. This is a creative brief, not evidence that an image was generated.

> Create ONE finished premium digital collectible artwork for TonPlaygram's [GAME NAME]. Subject: [SUBJECT DESCRIPTION]. Follow the supplied in-game/reference images for the equipment shape, court or board geometry, local palette and game identity. Reimagine those elements as a luxury physical collectible, not a screenshot or flat logo. Precise crafted geometry, physically plausible materials, fine surface detail, polished resin, restrained champagne-gold or platinum accents and a deep obsidian presentation. Authentic material appropriate to this specific object. Soft warm key light from the visual upper left, subtle cyan rim light from the visual right, grounded soft contact shadow, controlled highlights, no clipped whites. Near-black midnight studio backdrop, readable silhouette, front-facing three-quarter product view, entire object visible, large centered hero, balanced negative space and consistent framing with the approved series reference. Square master image. No UI, caption, watermark, rarity tag, price, decorative text, unrelated character, generic gift box, stock icon, emoji, excessive glow or multiple panels. Produce only the single artwork, not a contact sheet. Make the exact game recognizable even at thumbnail size. Match the approved series reference's lighting and material quality without copying another collectible's silhouette.

## Full replacement slate: 86 distinct subjects

Five subjects per game (85), plus one extra Pool Royale flagship (86). These are creative titles, not claims of existing achievements or unlockable equipment. Scene accuracy must be checked against the actual game. The slug is the exact key from the Games-page catalog.

### 01 — Royal Lanes Bowling (`royallanes`)

1. **Midnight Strike** — A polished black bowling ball with restrained cyan marbling beside an ivory pin with a thin gold neck band; clearly formed finger holes.
2. **Ten-Pin Throne** — A complete bowling-pin arrangement on a compact lacquered lane section, with crisp silhouettes and warm wood detail.
3. **Lane Runner** — A sculptural miniature of the final bowling approach into the lane, with a hero ball and finely machined gutter edges.
4. **Split Breaker** — A ball visually traveling between two standing pins, caught in a clean physical collectible composition without an explosion.
5. **Perfect Game** — A bowling-specific crystal trophy enclosing a tiny ball and pin; no score, reward amount, or edition claim.

### 02 — Table Tennis Royal (`tabletennisroyal`)

6. **Carbon Spin** — A carbon-fiber paddle with realistic rubber texture and an ivory table-tennis ball, precision gold edge hardware.
7. **Match Point** — Two deliberately contrasting paddles and one ball arranged as a balanced tournament collectible, not tennis rackets.
8. **Net Master** — A short premium table corner with taut fine-mesh net and a ball just above the playing surface.
9. **Tour Champion** — A compact trophy shaped from a table-tennis paddle profile, crystal inset and a floating-looking but physically supported ball.
10. **Royal Rally** — A miniature table-tennis arena with recognizable table proportions, restrained overhead light and uncluttered spectator background.

### 03 — Tirana Streets (`tiranastreets`)

11. **City Sentinel** — A compact street-corner diorama using the game's actual street and architectural references; obsidian display foundation and subtle cyan route lighting.
12. **Night Operation** — A fictional protective helmet and fabric gloves from the game's visual language, treated as premium equipment; no real military insignia.
13. **Waypoint Relic** — A machined navigation device displaying a simplified route drawn from the game's map reference, not a fabricated city map.
14. **Urban Shield** — A compact defensive equipment collectible with the game's material and color references; no real-world organizational badges.
15. **Skyline Monument** — A sharply crafted miniature of a landmark actually represented in the game, verified against its screenshots before generation.

### 04 — Tennis Royal (`tennisroyal`)

16. **Golden Serve** — A professional tennis racket with individually readable strings and a textured yellow tennis ball; black frame with selective gold detailing.
17. **Centre Court** — A compact blue-court diorama with an accurately referenced net and court markings from Tennis Royal.
18. **Championship Cup** — A tennis-specific silver and crystal cup with a sculptural racket motif, no fabricated tournament branding.
19. **Baseline Precision** — A racket head, textured ball and small baseline court section composed as a close-view premium collectible.
20. **Royal Ace** — A single tennis ball suspended in an elegant curved metal support above a small court-line base; no magical extra equipment.

### 05 — Racing Royal (`kartroyale`)

21. **Carbon Apex** — One of the game's racing vehicles reimagined as a collectible scale model; use the actual vehicle class and silhouette, not an invented supercar.
22. **Pole Position** — A motorsport helmet with a dark visor, satin graphite shell and precise metallic detailing, in the game's visual style.
23. **Turbo Heart** — A compact stylized power-unit collectible tied to the game's vehicle design, with machined metal and carbon-fiber surfaces.
24. **Finish Line** — A racing wheel beside a folded checkered flag on an uncluttered sculptural base; legible carbon and rubber surfaces.
25. **Circuit Crown** — A small diorama of an actual authored circuit corner with one racing vehicle; retain the referenced track geometry and barriers.

### 06 — Texas Hold'em (`texasholdem`)

26. **Pocket Aces** — Two accurately indexed aces with embossed edge treatment beside a small stack of unbranded poker chips; no monetary denomination.
27. **Royal Flush** — Five correctly ranked cards of one suit displayed in a premium fan; manually check every rank and suit after generation.
28. **Dealer's Seal** — A tactile round dealer-button collectible beside precision-machined chips, no currency symbols or promised winnings.
29. **Midnight Table** — A compact black-felt poker-table diorama with elegant rail upholstery and a restrained card-and-chip arrangement.
30. **All-In Relic** — A sculptural stack of ceramic poker chips enclosed by a slender glass arc, emphasizing craftsmanship rather than wealth claims.

### 07 — Domino Royal 3D (`domino-royal`)

31. **Double Six** — Two substantial ivory-and-obsidian domino tiles with exact pip layouts, beveled edges and fine gold divider inlay.
32. **Obsidian Chain** — A short, valid connected domino sequence on a dark felt strip; no impossible connections or random dots.
33. **Ivory Cascade** — Three domino tiles at distinct supported angles, collectible sculpture rather than a cluttered falling chain.
34. **The Final Tile** — A single finishing domino poised beside a small matching chain, using a layout verified against the game's rules.
35. **Domino Arena** — The game's characteristic table and domino arrangement as a compact three-quarter diorama, not a generic board.

### 08 — Pool Royale (`poolroyale`)

36. **Obsidian Eight** — One polished black eight-ball, white roundel and exact numeral 8, selective gold presentation cradle.
37. **Precision Cue** — A finely detailed cue resting diagonally with chalk and a white cue ball; no distortion to its straight shaft.
38. **Golden Break** — A geometrically correct compact pool rack, recognizable balls and restrained brass frame, referenced to the supported game variant.
39. **Royal Table** — A miniature Pool Royale table with authentic felt, pockets, rails and wood finish from the game.
40. **Corner Pocket** — A close-view table-corner collectible with a ball at the pocket, precise leather or liner detail and polished rail hardware.

### 09 — Snooker Royal (`snookerroyale`)

41. **Black Ball Prestige** — A glossy unnumbered black snooker ball with a single red companion, distinct from numbered pool balls.
42. **Crimson Triangle** — A correct snooker red-ball rack on deep green baize, with crisp spacing and no invented numbered balls.
43. **Master Cue** — A refined snooker cue and chalk in a dark wood display; proportions and rest details follow the game's equipment.
44. **Green Baize Hall** — A compact Snooker Royal table diorama with correct pocket and cushion appearance based on the game.
45. **Final Frame** — A premium snooker trophy composition using an unnumbered black ball, crystal structure and restrained silver work.

### 10 — Air Hockey (`airhockey`)

46. **Neon Puck** — A glossy dark air-hockey puck with subtle cyan edge light, grounded on a perforated table-surface fragment.
47. **Striker Elite** — A single machined-looking air-hockey striker, readable handle and low circular base, black and platinum finish.
48. **Face-Off** — Two complementary strikers facing a single puck in a compact display; no ice-hockey sticks or equipment.
49. **Goal Line** — A puck and accurately referenced goal-mouth section with table ventilation detail and controlled neon trim.
50. **Neon Arena** — A miniature of the actual air-hockey table, legible play surface and clean perimeter illumination.

### 11 — Snake & Ladder (`snake`)

51. **Emerald Climb** — A game-board snake coiled around a finely crafted ladder, mounted on a small recognizable board section.
52. **Golden Ladder** — A miniature ladder ascending across the actual game's board pattern; no generic fantasy architecture.
53. **Fortune Roll** — Two tactile dice on a board-square base, exact pip arrangements and restrained enamel detailing.
54. **Summit Token** — A premium version of the game's player token at the top of a short ladder; preserve its real silhouette.
55. **Royal Ascent** — A compact Snake & Ladder board diorama with a small number of readable snakes and ladders taken from the game reference.

### 12 — Murlan Royale (`murlanroyale`)

56. **Murlan Hand** — A beautifully crafted fan of playing cards using the actual Murlan deck and art references, not Texas Hold'em imagery.
57. **Last Card** — One specific card from the game's deck raised above a small refined card-table section; rank and suit checked.
58. **Royal Deck** — A premium stacked deck with a subtle embossed back design based on Murlan Royale's visual identity.
59. **Table Tactician** — A compact game-table diorama with a rule-valid arrangement referenced from actual Murlan gameplay.
60. **Murlan Laureate** — A game-specific crystal and platinum trophy incorporating the deck-back motif, not a generic crown or poker chips.

### 13 — Chess Battle Royal (`chessbattleroyal`)

61. **Obsidian King** — A sculptural black chess king with precision-cut gold inlays and a small alternating-square base.
62. **Platinum Knight** — A beautifully carved knight with a distinct horse silhouette, selective polished edges and satin material contrast.
63. **Queen's Command** — A premium queen and one opposing pawn composed on a short board strip; game-piece proportions remain coherent.
64. **Royal Rook** — A weighty rook with carefully machined battlements, dark metal core and pale reflective accents.
65. **Checkmate Board** — A compact chess-board diorama using a verified legal checkmate from the game, not randomly placed pieces.

### 14 — Checkers Battle Royal (`checkersbattleroyal`)

66. **Crowned Disc** — A kinged checker represented by the game's actual stacking or king-marking method, no added chess piece.
67. **Obsidian Stack** — Three tactile dark checkers with gold edge machining and visibly distinct disc silhouettes.
68. **Diagonal Capture** — A simple valid capture position on a short checkerboard fragment, checked against the implemented variant.
69. **Ivory Rival** — Two opposing stacks of contrasting checker pieces with precise concentric edge detail.
70. **Royal Draughts** — A miniature of the game's checkerboard and pieces, with correct board pattern and uncluttered composition.

### 15 — 4 in a Row (`fourinrowroyale`)

71. **Winning Four** — Four aligned discs in the actual game's board format; alignment instantly readable in a small thumbnail.
72. **Final Drop** — A single disc entering the referenced board structure in a restrained moment of motion.
73. **Obsidian Grid** — A compact luxury version of the game's grid, with dark framework and distinct contrasting disc materials.
74. **Double Threat** — A rule-valid tactical position showing two threats, verified against gameplay before rendering.
75. **Alignment Trophy** — A crystal-and-metal sculpture built from four aligned discs, not a generic cup with unrelated props.

### 16 — Backgammon Royal (`tavullbattleroyal`)

76. **Golden Points** — A miniature backgammon board corner with precisely alternating elongated points and tactile checkers.
77. **Ivory Roll** — Two correctly formed dice, a refined dice cup and one checker, reflecting the game's actual equipment.
78. **Home Board** — A compact home-board arrangement based on a valid position, with wood grain and ivory inlay.
79. **Bearing Off** — A simple verified bearing-off position expressed as a collectible board fragment, not a fabricated rule mechanic.
80. **Royal Backgammon** — An open premium backgammon case with accurate point pattern and restrained checker arrangement.

### 17 — Ludo Battle Royal (`ludobattleroyal`)

81. **Ruby Runner** — One recognizable Ludo pawn in jewel-red enamel, graphite base and selective gold detailing.
82. **Sapphire Home** — A blue Ludo pawn on its miniature home section, with accurate game-board shapes.
83. **Four Houses** — The four distinct Ludo home colors represented as a clean miniature board collectible, not four arbitrary gems.
84. **Lucky Six** — A six-face-up die beside a Ludo pawn on a relevant board section; every visible pip face checked for plausibility.
85. **Homecoming** — A winning pawn composition in the game's actual home area, no invented achievement badge or reward claim.

### 18 — Extra flagship: Pool Royale (`poolroyale`)

86. **Pool Royale — Collector's Table** — A more ambitious hero diorama of the actual Pool Royale table, one cue and a restrained ball arrangement under a slim architectural light fixture. An independently composed flagship, not a recolor of Royal Table. It remains explicitly tied to a listed game, not a generic platform trophy.

## Reference preparation and generation workflow

1. Capture or export the real game's equipment and arena screenshots; use the catalog image as a secondary identity reference. Supply those references to the image-enabled ChatGPT session. Do not claim references were supplied when they were only described.
2. Generate one flagship artwork per game first, starting with Pool Royale, Racing Royal, Chess Battle Royal and Royal Lanes Bowling. Inspect material realism, game identity and portrait-card readability.
3. Lock an approved series reference and reuse it with each independent subject. Generate every final artwork separately, not a sprite sheet to be cropped into low-quality images.
4. Review all 86 full-size masters and their small phone thumbnails. Correct malformed equipment, card ranks, pips, board layouts, duplicated objects, clipped edges or inconsistent illumination with focused image edits.
5. Retain original output files and their available generation/provenance metadata. Record generator, generation date, source-reference files, prompt revision and visual approval; never populate those fields speculatively.

## Integration acceptance criteria

- Replace generic collection tabs with the actual game names; use exact `gameSlug` keys to tie gifts to the Games page and its routes.
- Do not mutate live ownership, historical receipt meaning, prices, rarity, balances or event behavior merely to replace artwork. Define an explicit mapping from current gift IDs to versioned replacement artwork. Preserve legacy display information where needed. An art slot number is not a database migration instruction.
- Remove generic animals, sweets, space trinkets and unrelated jewelry from the replacement storefront. If a character belongs to a game, it must be traceable to that game's actual references.
- Every integrated item must have approved artwork, game attribution and a valid image path. Missing generation must not be disguised with the rejected SVG art. Do not release placeholder cards as completed NFTs.
- Export appropriately sized WebP/AVIF thumbnails and retain high-resolution source masters. Use consistent square crops, no text baked into thumbnails, responsive `srcset`, lazy loading and predictable aspect ratios.
- Use actual generated images for cards, details, gift confirmations, owned-gift shelves and transaction/profile previews. Verify asset coverage across all consumers.
- A 2D AI-generated product render is not a 3D model. Keep any React + Three.js + TypeScript viewer separately and honestly labeled; do not imply that rotating a plane exposes a generated object's unseen geometry. Any rebuilt 3D assets require their own verification.
- Confirm metadata registration with any mint provider; artwork generation alone does not mint an NFT or verify on-chain ownership.
- Retest at 320, 360, 390 and 430 portrait widths, including bottom navigation, safe areas, no horizontal clipping, fast first load and readable object silhouettes.

## Completion status

Completed in this revision: inspected the current PR and actual Games-page source, selected a coherent premium direction, and wrote 86 game-specific subject briefs.

Not completed: image generation, asset optimization, replacing the running catalog or UI artwork, migration mapping, image-based visual approval, or deployment. Earlier mock-preview test results do not validate this pending art revision. No production changes or financial transactions were made.
