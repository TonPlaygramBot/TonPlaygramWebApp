import { ingestPublicContent } from '../../packages/ingestion-public/src/parser.js';

describe('auto platform index generation', () => {
  test('adds platform route map from current webapp routes', () => {
    const articles = ingestPublicContent(process.cwd());
    const routeMap = articles.filter((article) => article.slug === 'platform-route-map');
    expect(routeMap.length).toBeGreaterThan(0);
    const joined = routeMap.map((entry) => entry.content).join('\n');
    expect(joined).toContain('/wallet');
    expect(joined).toContain('/games');
  });
});
