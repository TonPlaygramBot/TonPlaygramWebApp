# Ura e Tabakëve / Petro Nini Luarasi neighborhood update

The runtime adds details to **333 retained mapped building footprints**, including **17 school/kindergarten buildings**, across the Ura e Tabakëve–Petro Nini Luarasi–Njësia 2–Grandi–Ali Demi area. Existing walls, windows, institution identities, shops, collision outlines and the Grand model keep their original owners. New details include shallow façade bands, classroom floor bands, selected open shutters and window hoods, and roof tanks positioned inside real outlines. This is architectural interpretation on OSM geometry, not an individually surveyed reconstruction of every building.

**394 supplementary trees** use the existing canopy instance batches and distance LOD: 340 beside streets and 54 by the Lana banks. Both sides are represented. Street trees are taller and have larger crowns than riverbank trees. All new trunks are rejected from carriageways, footpaths, buildings, the river channel, existing trunks and the historic bridge's immediate setting. One existing nearby source trunk receives a dimension upgrade while retaining its location. Tree locations and sizes are authored, not a verified inventory.

The historical **Ura e Tabakëve** has authored stone masonry, a cobbled hump deck, a large arch with two smaller side openings, and pale arch-ring stone. The municipality's photo and text guide its form. The 2.5 m walkway and 8 m main opening follow the municipal description; other dimensions remain estimates. It remains at the mapped pedestrian bridge, beside the modern Lana alignment. `tabakeveBridgeHeight(x,z)` exports the same deck profile used by rendering for gameplay traversal.

**Big Market and Njësia Administrative Nr. 2 retain mapped locations.** New Century21 West lettering is mounted on a mapped frontage across from Big Market, with a generic Byrektore below. Century21's street is independently confirmed; the exact suite, elevation and unnamed bakery are based on the user's local reference and remain estimates. The neighboring mapped KMY storefront is retained. No reference photos or third-party logos are redistributed as textures.

## References checked 22 September 2026

- Tirana Municipality: <https://tirana.al/pika-interesi/ura-e-tabakeve-6924>; reference photo <https://tirana.al/uploads/images/points-of-interes/20190704100738_ura-e-tabakeve-foto.jpg>. Photo was visually inspected.
- Big Market branch: <https://bigmarket.al/markets/20>. Published location agrees with the existing branch near Njësia 2.
- Century21 West: <https://www.century21albania.com/en/office/century%2021%20west.html>. Its supplied image is a logo, not a verified exterior survey.
- Existing OSM identities include Njësia 2 node 10950616148, Big Market node 11386381423, Shkolla Kombëtare Koreografike mapped building 443993963 and Gjimnazi Aristoteli mapped building 1348684861.
- Older Grand exterior reference: <https://wikimapia.org/14185230/sq/Kompleksi-Grand>. Reference capture date is not established; existing dedicated Grand geometry was retained.

## Runtime and verification

The additional façade layer uses two instance batches, a shared 1024 × 256 text atlas and a small bridge mesh. It selects up to 36 nearby buildings and caps rectangular details at 2,400 instances; battery mode uses 14 buildings and 650 instances. New trees share existing global canopy budgets and three levels of detail. WorldEnhancements owns update/retire/dispose integration. Existing façade/window layers are not duplicated.

`node --test test/tiranaTabakeveQuarter.test.mjs`: **5 passing tests**, covering source outlines and rooftop placement, clear tree placement, both bank/street sides, canopy proportions, duplicate rejection, estimated storefront placement and bridge traversal geometry. The neighborhood TypeScript check reports existing missing declarations in legacy mosque/east/street-safety modules; it reports no errors in the new quarter files. Browser/phone rendering verification is tracked by the enclosing gameplay update.
