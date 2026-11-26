# Source-tagged traffic controls for Tirana Streets solo

Source coordinates: OpenStreetMap contributors, ODbL 1.0
(<https://www.openstreetmap.org/copyright>). The node IDs are OpenStreetMap IDs.
This pass checks the archived neighborhood and eastern extracts already shipped
under assets-source, plus OSM 0.6 map bbox extracts reviewed for Laprakë, Kombinat,
Don Bosko and Kinostudio. The runtime excerpt keeps the raw node version where
present, tags, position in the existing metre datum, and source archive.
Archive checksums are next to that data. Source extracts are not a live survey.

Only highway=traffic_signals nodes with a unique, usable inbound road leg
matching an explicit traffic_signals:direction tag become active. The node is
the controller position; exact pole locations, hardware, turn phases, cycle
lengths and timings are not surveyed. Pole positions use the checked roadside
offset, and phases are for the game only.

The 64 existing simulated controls continue to enforce their legacy timings
outside vetted coverage. Their lenses now use the same gameplay clock as new
controls. Additional mapped casings lacking an unambiguous active binding are
not animated in solo; unsupported directional readings are not invented. No
online map requests, new materials, or path or traffic-rule changes in Racing.
