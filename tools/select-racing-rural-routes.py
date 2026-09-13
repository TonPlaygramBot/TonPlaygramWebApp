"""Choose simple connected circuits; no invented links or rescaled geography."""
import json, math, sys
import networkx as nx
from shapely.geometry import Polygon

routes = []
for region in json.load(sys.stdin):
    graph = nx.Graph()
    for road in region['roads']:
        a, b = tuple(road['a']), tuple(road['b'])
        if a != b:
            graph.add_edge(a, b, weight=math.dist(a, b), road=road)
    best = None
    for cycle in nx.cycle_basis(graph):
        polygon = Polygon(cycle)
        if not polygon.is_valid or polygon.area < 45000:
            continue
        edges = [graph[a][b] for a, b in zip(cycle, cycle[1:] + cycle[:1])]
        length = sum(e['weight'] for e in edges)
        if not 1600 < length < 5600:
            continue
        offroad = sum(e['weight'] for e in edges if e['road']['offroad']) / length
        if region['surface'] != 'asphalt' and offroad < .3:
            continue
        turns = []
        for i, p in enumerate(cycle):
            a, b = cycle[i-1], cycle[(i+1) % len(cycle)]
            incoming, outgoing = math.atan2(p[0]-a[0], p[1]-a[1]), math.atan2(b[0]-p[0], b[1]-p[1])
            turns.append(abs(math.atan2(math.sin(outgoing-incoming), math.cos(outgoing-incoming))))
        score = abs(math.log(length/region['target'])) + sum(t > 1.9 for t in turns)*.04
        if best is None or score < best[0]:
            best = (score, cycle, edges, length, offroad)
    if best is None:
        raise RuntimeError('No clear connected circuit for '+region['id'])
    _, points, edges, length, offroad = best
    routes.append({**{k: region[k] for k in ('id', 'name', 'district', 'surface', 'accent')},
                   'points': points, 'widths': [e['road']['width'] for e in edges],
                   'originalLength': length, 'offroadFraction': round(offroad, 3),
                   'streets': sorted({e['road']['name'] for e in edges if e['road']['name']}),
                   'sources': sorted({e['road']['source'] for e in edges}),
                   'terrainMode': 'regional', 'roadFeelVersion': 1,
                   'mapVersion': 'tirana-rural-racing-v1', 'width': 12,
                   'sky': '#b5cfdb', 'ground': '#8a9871'})
print(json.dumps(routes))
