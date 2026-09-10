"""Retain OSM evidence discarded by the original Tirana map exporter.

This creates a presentation dataset, never rewrites WORLD/collision/navigation.
Input must be a complete OSM XML map response. No online request runs at build time.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

ORIGIN = [41.3275, 19.8188]
BOUNDS = [-805, -380, 660, 1150]
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=19.809,41.317,19.827,41.331'
KEEP = {'name', 'name:en', 'amenity', 'healthcare', 'tourism', 'office', 'government',
        'diplomatic', 'country', 'operator:type', 'building', 'building:levels',
        'height', 'building:colour', 'building:material', 'roof:shape', 'roof:colour',
        'roof:height', 'roof:levels', 'addr:street', 'website', 'check_date',
        'natural', 'genus', 'species', 'leaf_type', 'leaf_cycle', 'diameter_crown',
        'circumference', 'highway', 'width', 'lanes', 'surface', 'oneway', 'bicycle',
        'access', 'bridge', 'tunnel', 'layer', 'entrance'}


def tags(element):
    return {t.get('k'): t.get('v') for t in element.findall('tag')}


def xy(node):
    lat, lon = float(node.get('lat')), float(node.get('lon'))
    if not math.isfinite(lat + lon) or abs(lat) > 90 or abs(lon) > 180:
        raise ValueError('Invalid geographic node')
    return [round((lon - ORIGIN[1]) * 111320 * math.cos(math.radians(ORIGIN[0])), 2),
            round((ORIGIN[0] - lat) * 111320, 2)]


def inside(p):
    return BOUNDS[0] <= p[0] <= BOUNDS[2] and BOUNDS[1] <= p[1] <= BOUNDS[3]


def category(t):
    if t.get('diplomatic') in ('embassy', 'consulate'):
        return t['diplomatic']
    if t.get('amenity') in ('police', 'hospital', 'clinic', 'school', 'university',
                            'fire_station', 'townhall', 'casino'):
        return t['amenity']
    if t.get('tourism') == 'hotel':
        return 'hotel'
    if t.get('office') == 'government':
        return 'government'
    return None


def extract(raw, acquired_at):
    root = ET.fromstring(raw)
    if root.tag != 'osm' or root.find('error') is not None or root.find('remark') is not None:
        raise ValueError('Expected a complete OSM XML response')
    nodes = {n.get('id'): n for n in root.findall('node')}
    positions = {key: xy(node) for key, node in nodes.items()}
    trees, roads, buildings, places, entrances = [], [], [], [], []
    for element in list(root):
        if element.tag not in ('node', 'way'):
            continue
        t = tags(element)
        identity = f"{element.tag}/{element.get('id')}"
        p = [positions[element.get('id')]] if element.tag == 'node' else None
        refs = [n.get('ref') for n in element.findall('nd')]
        if p is None:
            if any(ref not in positions for ref in refs):
                raise ValueError(f'{identity}: incomplete node references')
            p = [positions[ref] for ref in refs]
        if not p or not any(inside(point) for point in p):
            continue
        retained = {key: value for key, value in t.items() if key in KEEP or key.startswith('cycleway')}
        base = {'id': identity, 'version': int(element.get('version', '0')),
                'editedAt': element.get('timestamp'), 'tags': retained}
        if element.tag == 'node':
            base['p'] = p[0]
            if t.get('natural') == 'tree':
                trees.append(base)
            if t.get('entrance') in ('yes', 'main', 'service'):
                entrances.append(base)
        else:
            base['p'] = p
            if t.get('building') and t['building'] not in ('no', 'roof'):
                if len(refs) < 4 or refs[0] != refs[-1]:
                    raise ValueError(f'{identity}: open building footprint')
                buildings.append(base)
            if t.get('highway') == 'cycleway' or any(key.startswith('cycleway') for key in t):
                roads.append({**base, 'nodes': refs})
        kind = category(t)
        if kind:
            places.append({**base, 'category': kind})
    return {'schema': 1, 'origin': ORIGIN, 'bounds': BOUNDS, 'source': SOURCE,
            'acquiredAt': acquired_at, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'attribution': '© OpenStreetMap contributors · ODbL 1.0',
            'accuracy': 'Mapped positions and tags; not a survey. Missing dimensions remain unknown.',
            'coverage': {'relations': 'Not promoted: complex campuses need independent footprint review.',
                         'outsideBounds': 'Not promoted into the playable city.'},
            'trees': trees, 'roads': roads, 'buildings': buildings,
            'places': places, 'entrances': entrances}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--acquired-at', required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] /
                        'src/games/tirana-city-source/sourceData.mjs')
    args = parser.parse_args()
    data = extract(args.input.read_bytes(), args.acquired_at)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('// OSM-derived presentation data. See DATA-LICENSE.md. Generated by import-tirana-city-details.py.\n'
                           'export const CITY_SOURCE = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(json.dumps({key: len(data[key]) for key in ('trees', 'roads', 'buildings', 'places', 'entrances')}))
