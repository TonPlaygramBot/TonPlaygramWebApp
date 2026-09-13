// Offline authoring from the checked-in OSM graph. Never runs in a game loop.
import { writeFile } from 'node:fs/promises';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { buildingClearance } from '../webapp/src/games/kartroyale/raceCourse.mjs';
import { TIRANA_ROUTES } from '../webapp/src/games/kartroyale/tirana-routes.mjs';
import { roadGraph, extendMappedRoute, routeLength, combineMappedLoops } from '../webapp/src/games/kartroyale/grandRouteCore.mjs';

// Closed events may widen mapped streets; no coordinates or city buildings move.
const roads = WORLD.roads.map(r => ({ ...r, w: Math.max(6, r.w) }));
const originals = [...TIRANA_ROUTES, combineMappedLoops(TIRANA_ROUTES[2], TIRANA_ROUTES[3])];
const routes = [];
for (const route of originals) {
  const xs = route.points.map(p => p[0]), zs = route.points.map(p => p[1]);
  const bounds = [Math.min(...xs)-450,Math.max(...xs)+450,Math.min(...zs)-450,Math.max(...zs)+450];
  const mappedEdges = new Set(route.points.map((p,i)=>[p.join(','),route.points[(i+1)%route.points.length].join(',')].sort().join('|')));
  const clear = r => {
    if (mappedEdges.has([r.a.join(','),r.b.join(',')].sort().join('|'))) return true;
    const count=Math.max(1,Math.ceil(Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])/4));
    for(let i=0;i<=count;i++)if(buildingClearance(r.a[0]+(r.b[0]-r.a[0])*i/count,r.a[1]+(r.b[1]-r.a[1])*i/count)<5.6)return false;
    return true;
  };
  const graph = roadGraph(roads.filter(r => [r.a,r.b].every(p => p[0]>=bounds[0] && p[0]<=bounds[1] && p[1]>=bounds[2] && p[1]<=bounds[3]) && !r.walk && clear(r)));
  const length = routeLength(route.points), target = Math.min(3100, length * 1.7);
  const landmark = WORLD.landmarks.find(p=>p.id===({skanderbeg:'square',stadium:'mother','lana-pyramid-grand':'pyramid'}[route.id]||route.id));
  const junctions = route.points.map((p, i) => ({ p, i })).filter(({ p }) => graph.edges.get(p.join(','))?.size > 2);
  let best;
  for (const { i } of junctions.filter((_, i) => i % Math.max(1, Math.floor(junctions.length / 10)) === 0)) {
    const rotated = { ...route, points: [...route.points.slice(i), ...route.points.slice(0, i)] };
    const candidate = extendMappedRoute(rotated, graph, { ratio: 1.4, maxRatio: route.id.endsWith('grand') ? 2.2 : 2, maxLength: route.id.endsWith('grand') ? 4300 : 3400, candidates: 48, junctionsOnly: true, accept: points => !landmark || Math.min(...points.map(p=>Math.hypot(p[0]-landmark.x,p[1]-landmark.z))) < (route.id==='lana'?320:180) });
    if (candidate && (!best || Math.abs(candidate.length - target) < Math.abs(best.length - target))) best = candidate;
  }
  if (!best) throw Error('No connected district extension for ' + route.id);
  routes.push({ id: route.id, points: best.points, streets: best.streets,
    originalLength: length, length: best.length });
  console.log(route.id, Math.round(length), '→', Math.round(best.length), 'metres');
}
await writeFile(new URL('../webapp/src/games/kartroyale/district-routes.mjs', import.meta.url),
  '// Closed-event extensions on the checked-in Tirana road graph. © OpenStreetMap contributors, ODbL 1.0.\n' +
  '// Reproduce with node scripts/build-racing-district-routes.mjs.\n' +
  'export const DISTRICT_ROUTES = ' + JSON.stringify(routes) + ';\n');
