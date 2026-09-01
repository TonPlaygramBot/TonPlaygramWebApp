import fs from 'node:fs';

describe('profile database readiness', () => {
  const server = fs.readFileSync('bot/server.js', 'utf8');
  const renderConfig = fs.readFileSync('render.yaml', 'utf8');

  test('reports the MongoDB connection state from the deployment health check', () => {
    expect(server).toMatch(
      /app\.get\('\/api\/health'[\s\S]*?mongoose\.connection\.readyState === 1/
    );
    expect(renderConfig).toMatch(
      /name: tonplaygram-bot[\s\S]*?healthCheckPath: \/api\/health/
    );
  });

  test('fails profile and account requests quickly while MongoDB is unavailable', () => {
    expect(server).toContain("app.use('/api/account', requireDatabase, accountRoutes)");
    expect(server).toContain("app.use('/api/profile', requireDatabase, profileRoutes)");
    expect(server).toContain("error: 'Profile database is temporarily unavailable. Please try again.'");
  });
});
