"""Compatibility entry for the current Parliament mission generator.
Pass the downloaded OSM roads and optional buildings JSON snapshots.
"""
import pathlib, runpy, sys
if len(sys.argv)<2:
    raise SystemExit('Usage: python build-racing-tirana.py OVERPASS_ROADS_JSON [BUILDINGS_JSON]. See docs/kart-royale.md.')
runpy.run_path(str(pathlib.Path(__file__).with_name('build-racing-missions.py')),run_name='__main__')
