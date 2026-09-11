"""Read a user-supplied .osm XML or .osm.pbf extract without network requests.

PBF requires pyosmium (`python -m pip install osmium`). XML uses the stdlib.
Retain complete objects intersecting the collection envelope, plus all recursive
references. Do not clip polygons, simplify roads or remove private properties.
This selects source data only; it never marks an incomplete city runtime-ready.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

REGION_BBOX = (19.680, 41.240, 19.980, 41.460)


def read_elements(path):
    if str(path).endswith('.pbf'):
        try:
            import osmium
        except ImportError as exc:
            raise RuntimeError('PBF needs pyosmium: python -m pip install osmium') from exc
        # Copy every value before the streaming reader advances its buffer.
        for obj in osmium.FileProcessor(str(path)):
            kind = {'n': 'node', 'w': 'way', 'r': 'relation'}[obj.type_str()]
            item = {'type': kind, 'id': obj.id, 'tags': dict(obj.tags)}
            if kind == 'node':
                item.update(lat=obj.location.lat, lon=obj.location.lon)
            elif kind == 'way':
                item['nodes'] = [node.ref for node in obj.nodes]
            else:
                item['members'] = [dict(type={'n': 'node', 'w': 'way', 'r': 'relation'}[m.type],
                                        ref=m.ref, role=m.role) for m in obj.members]
            yield item
        return
    if not str(path).endswith(('.osm', '.xml')):
        raise ValueError('Expected .osm, .xml or .osm.pbf')
    events = ET.iterparse(path, events=('start', 'end'))
    _, root = next(events)
    if root.tag != 'osm':
        raise ValueError('Expected a complete OSM document, not an OSM change file')
    for event, obj in events:
        if event != 'end' or obj.tag not in ('node', 'way', 'relation'):
            continue
        item = {'type': obj.tag, 'id': int(obj.attrib['id']),
                'tags': {tag.attrib['k']: tag.attrib['v'] for tag in obj.findall('tag')}}
        if obj.tag == 'node':
            item.update(lat=float(obj.attrib['lat']), lon=float(obj.attrib['lon']))
        elif obj.tag == 'way':
            item['nodes'] = [int(n.attrib['ref']) for n in obj.findall('nd')]
        else:
            item['members'] = [dict(type=m.attrib['type'], ref=int(m.attrib['ref']),
                                    role=m.attrib.get('role', '')) for m in obj.findall('member')]
        yield item
        root.clear()


def wanted(tags):
    return any(key in tags for key in ('highway', 'building', 'building:part', 'waterway',
                                      'aeroway', 'shop', 'amenity', 'office', 'tourism', 'historic')) \
        or tags.get('natural') in ('water', 'coastline') or tags.get('landuse') == 'reservoir'


def select_region(elements, bbox=REGION_BBOX):
    west, south, east, north = bbox
    if not all(math.isfinite(v) for v in bbox) or not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError('Invalid WGS84 bbox')
    nodes, ways, relations = {}, {}, {}
    groups = {'node': nodes, 'way': ways, 'relation': relations}
    for item in elements:
        group = groups[item['type']]
        if item['id'] in group:
            raise ValueError(f"Duplicate {item['type']}/{item['id']}")
        group[item['id']] = item
    def node_point(ref):
        if ref not in nodes:
            raise ValueError(f'Missing source node/{ref}')
        n = nodes[ref]
        if not all(math.isfinite(n[k]) for k in ('lat', 'lon')) or abs(n['lat']) > 90 or abs(n['lon']) > 180:
            raise ValueError(f'Invalid source node/{ref}')
        return n['lon'], n['lat']
    def in_bbox(point):
        x, y = point
        return west <= x <= east and south <= y <= north
    # Bounding-box intersection intentionally retains full edge-crossing objects
    # and enclosing polygons even when no source vertex is inside our envelope.
    spatial_ways = set()
    for ref, way in ways.items():
        points = [node_point(n) for n in way['nodes']]
        if not points:
            raise ValueError(f'Empty source way/{ref}')
        if max(p[0] for p in points) >= west and min(p[0] for p in points) <= east \
                and max(p[1] for p in points) >= south and min(p[1] for p in points) <= north:
            spatial_ways.add(ref)
    spatial_nodes = {ref for ref in nodes if in_bbox(node_point(ref))}
    spatial_relations = set()
    # Fixed point supports nested relations without depending on ID order.
    changed = True
    while changed:
        changed = False
        for ref, relation in relations.items():
            if ref in spatial_relations:
                continue
            if any(m['ref'] in {'node': spatial_nodes, 'way': spatial_ways,
                                'relation': spatial_relations}[m['type']] for m in relation['members']):
                spatial_relations.add(ref)
                changed = True
    selected = set()
    todo = [('node', ref) for ref in spatial_nodes if wanted(nodes[ref]['tags'])]
    todo += [('way', ref) for ref in spatial_ways if wanted(ways[ref]['tags'])]
    todo += [('relation', ref) for ref in spatial_relations
             if wanted(relations[ref]['tags']) or ref == 20772795]
    while todo:
        kind, ref = todo.pop()
        if (kind, ref) in selected:
            continue
        if ref not in groups[kind]:
            raise ValueError(f'Missing source {kind}/{ref}')
        selected.add((kind, ref))
        obj = groups[kind][ref]
        if kind == 'way':
            todo.extend(('node', n) for n in obj['nodes'])
        elif kind == 'relation':
            todo.extend((m['type'], m['ref']) for m in obj['members'])
    if not selected:
        raise ValueError('Source extract contains no requested regional features')
    order = {'node': 0, 'way': 1, 'relation': 2}
    return [groups[kind][ref] for kind, ref in sorted(selected, key=lambda k: (order[k[0]], k[1]))]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        raise ValueError('Output must not overwrite the source extract')
    with args.input.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    elements = select_region(read_elements(args.input))
    result = {'elements': elements, 'selection': {'bbox': REGION_BBOX,
              'method': 'complete object bounding-box overlap with recursive references',
              'inputFile': args.input.name, 'inputSha256': digest,
              'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors'}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(elements)} source objects selected; no runtime geometry was promoted')


if __name__ == '__main__':
    main()
