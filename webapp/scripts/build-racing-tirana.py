"""Build closed race routes from the checked-in Tirana Streets OSM snapshot.

Uses ordinary Python only. Road direction restrictions are ignored for a closed
race event; the resulting paths consist exclusively of existing road segments.
"""
import heapq
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
world_source = (ROOT / 'webapp/src/games/tiranastreets/shared/world.mjs').read_text()
world = json.loads(re.search(r'export const WORLD\s*=\s*(\{.*\});', world_source, re.S).group(1))
graph = {}
for road in world['roads']:
    if road['walk']:
        continue
    a, b = tuple(road['a']), tuple(road['b'])
    edge = (math.dist(a, b), road['name'])
    graph.setdefault(a, {})[b] = edge
    graph.setdefault(b, {})[a] = edge


def shortest_path(start, end):
    queue, distances, previous = [(0, start)], {start: 0}, {}
    while queue:
        cost, node = heapq.heappop(queue)
        if node == end:
            break
        if cost > distances[node]:
            continue
        for neighbor, (length, _) in graph[node].items():
            if cost + length < distances.get(neighbor, math.inf):
                distances[neighbor] = cost + length
                previous[neighbor] = node
                heapq.heappush(queue, (cost + length, neighbor))
    else:
        raise ValueError(f'Disconnected street anchors: {start}, {end}')
    result = [end]
    while result[-1] != start:
        result.append(previous[result[-1]])
    return result[::-1]


def split_cycles(path):
    """Remove waypoint access spurs, retaining closed simple cycles."""
    seen = {}
    for i, node in enumerate(path):
        if node in seen:
            j = seen[node]
            return split_cycles(path[j:i]) + split_cycles(path[:j] + path[i:])
        seen[node] = i
    return [path] if len(path) > 2 else []


def edges(path):
    return zip(path, path[1:] + path[:1])


def distance(path):
    return sum(math.dist(a, b) for a, b in edges(path))


# Survey anchors in WORLD's existing coordinate system. These select real
# streets rather than being used directly as invented track control points.
plans = [
    ('skanderbeg', [(-220, -70), (-235, -166), (-87, -310), (195, -232), (258, -122), (50, 38)]),
    ('blloku', [(-397, 795), (-75, 725), (-39, 903), (-359, 982)]),
    ('lana', [(-110, 430), (58, 395), (302, 282), (321, 371), (70, 449)]),
    ('pyramid', [(70, 455), (285, 397), (342, 660), (119, 699)]),
    ('stadium', [(177, 1009), (234, 1120), (295, 1110), (382, 865), (175, 875)]),
]
routes = []
for identity, targets in plans:
    anchors = [min(graph, key=lambda node: math.dist(target, node)) for target in targets]
    walk = []
    for a, b in edges(anchors):
        walk += shortest_path(a, b)[:-1]
    cycle = max(split_cycles(walk), key=distance)
    if not 800 < distance(cycle) < 2000:
        raise ValueError(f'Unexpected circuit length: {identity}')
    streets = sorted({graph[a][b][1] for a, b in edges(cycle)} - {''})
    routes.append({'id': identity, 'points': cycle, 'streets': streets})
    print(f'{identity}: {distance(cycle):.0f} m, {len(cycle)} street nodes')

payload = json.dumps(routes, ensure_ascii=False, separators=(',', ':'))
header = ('// Derived from the Tirana Streets OpenStreetMap snapshot. © OpenStreetMap contributors, ODbL 1.0.\n'
          '// Full unsmoothed street centerlines; coordinate system and source retained from WORLD.\n')
(ROOT / 'webapp/src/games/kartroyale/tirana-routes.mjs').write_text(header + 'export const TIRANA_ROUTES = ' + payload + ';\n')
(ROOT / 'webapp/public/assets/kart-royale/tirana-routes.json').write_text(payload + '\n')
