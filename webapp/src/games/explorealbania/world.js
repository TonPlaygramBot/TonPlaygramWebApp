const project = (lon, lat) => ({
    x: (lon - 19.82) * 190,
    z: (lat - 41.33) * 245
});
const city = (id, name, lat, lon, industry) => ({ id, name, lat, lon, industry, ...project(lon, lat) });
// Geographic city positions are stored as latitude/longitude and projected at
// runtime. The road network is a compressed driving interpretation of Albania,
// not a turn-by-turn navigation product.
export const CITIES = [
    city('shkoder', 'Shkodër', 42.0693, 19.5033, 'Timber'),
    city('kukes', 'Kukës', 42.0769, 20.4219, 'Minerals'),
    city('lezhe', 'Lezhë', 41.7836, 19.6436, 'Agriculture'),
    city('tirana', 'Tirana', 41.3275, 19.8187, 'Logistics'),
    city('durres', 'Durrës', 41.3231, 19.4414, 'Port'),
    city('elbasan', 'Elbasan', 41.1125, 20.0822, 'Steel'),
    city('fier', 'Fier', 40.7239, 19.556, 'Energy'),
    city('berat', 'Berat', 40.7058, 19.9522, 'Food'),
    city('vlore', 'Vlorë', 40.4661, 19.4914, 'Port'),
    city('korce', 'Korçë', 40.6186, 20.7808, 'Produce'),
    city('gjirokaster', 'Gjirokastër', 40.0758, 20.1389, 'Stone'),
    city('sarande', 'Sarandë', 39.8756, 20.0053, 'Tourism')
];
export const cityById = (id) => CITIES.find((c) => c.id === id);
const ROAD_INPUTS = [
    ['shkoder', 'lezhe', 'SH1', [[19.57, 41.94]]],
    ['lezhe', 'tirana', 'A1 / SH1', [[19.67, 41.64], [19.74, 41.48]]],
    ['tirana', 'durres', 'SH2', [[19.63, 41.36]]],
    ['tirana', 'elbasan', 'A3', [[19.94, 41.22]]],
    ['tirana', 'kukes', 'A1', [[20.05, 41.64], [20.28, 41.86]]],
    ['durres', 'fier', 'SH4', [[19.47, 41.05], [19.5, 40.86]]],
    ['fier', 'vlore', 'A2', [[19.49, 40.6]]],
    ['fier', 'berat', 'SH73', [[19.77, 40.72]]],
    ['berat', 'elbasan', 'SH7', [[20.02, 40.91]]],
    ['elbasan', 'korce', 'SH3', [[20.34, 40.91], [20.6, 40.72]]],
    ['berat', 'gjirokaster', 'SH4', [[20.02, 40.42], [20.1, 40.22]]],
    ['vlore', 'sarande', 'SH8', [[19.57, 40.28], [19.73, 40.05]]],
    ['gjirokaster', 'sarande', 'SH4', [[20.08, 39.98]]],
    ['korce', 'gjirokaster', 'SH75', [[20.55, 40.42], [20.34, 40.22]]]
];
export const ROADS = ROAD_INPUTS.map(([a, b, name, mid = []]) => ({
    id: `${a}-${b}`,
    a,
    b,
    name,
    points: [
        cityById(a),
        ...mid.map(([lon, lat]) => project(lon, lat)),
        cityById(b)
    ].map(({ x, z }) => ({ x, z }))
}));
export const ALBANIA_OUTLINE = [
    [19.27, 42.12], [19.67, 42.65], [20.08, 42.56], [20.57, 42.22],
    [20.79, 41.88], [20.98, 41.32], [20.95, 40.91], [20.74, 40.46],
    [20.59, 40.08], [20.18, 39.62], [19.86, 39.7], [19.45, 40.04],
    [19.29, 40.42], [19.35, 40.88], [19.37, 41.35], [19.27, 42.12]
].map(([lon, lat]) => project(lon, lat));
const segmentLength = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
export const roadLength = (road) => road.points.slice(1).reduce((sum, p, i) => sum + segmentLength(road.points[i], p), 0);
export function pathBetween(from, to) {
    const distance = new Map(CITIES.map((c) => [c.id, Infinity]));
    const previous = new Map();
    const open = new Set(CITIES.map((c) => c.id));
    distance.set(from, 0);
    while (open.size) {
        const current = [...open].sort((a, b) => (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity))[0];
        open.delete(current);
        if (current === to)
            break;
        for (const road of ROADS.filter((r) => r.a === current || r.b === current)) {
            const next = road.a === current ? road.b : road.a;
            if (!open.has(next))
                continue;
            const candidate = (distance.get(current) ?? 0) + roadLength(road);
            if (candidate < (distance.get(next) ?? Infinity)) {
                distance.set(next, candidate);
                previous.set(next, { city: current, road });
            }
        }
    }
    const legs = [];
    let current = to;
    while (current !== from) {
        const step = previous.get(current);
        if (!step)
            return [];
        legs.unshift({ road: step.road, reverse: step.road.b !== current });
        current = step.city;
    }
    const points = [];
    for (const leg of legs) {
        const part = leg.reverse ? [...leg.road.points].reverse() : leg.road.points;
        points.push(...part.slice(points.length ? 1 : 0));
    }
    return points;
}
export function distanceKm(from, to) {
    const points = pathBetween(from, to);
    const units = points.slice(1).reduce((sum, p, i) => sum + segmentLength(points[i], p), 0);
    return Math.round(units * 0.55);
}
