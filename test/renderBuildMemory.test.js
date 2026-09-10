const fs = require('node:fs');

describe('Render webapp build memory', () => {
  test('does not restore the V8 heap limit that crashes the production bundle', () => {
    const renderConfig = fs.readFileSync('render.yaml', 'utf8');
    const buildRunner = fs.readFileSync('webapp/scripts/run-vite-build.mjs', 'utf8');

    expect(renderConfig).toMatch(/WEBAPP_BUILD_MAX_OLD_SPACE_SIZE=3072/);
    expect(renderConfig).not.toMatch(/WEBAPP_BUILD_MAX_OLD_SPACE_SIZE=1536/);
    expect(buildRunner).toMatch(/const defaultLimitMb = 3072/);
  });
});
