describe('API endpoint selection', () => {
  const originalWindow = global.window;
  const originalApi = process.env.VITE_API_BASE_URL;
  afterEach(() => {
    global.window = originalWindow;
    if (originalApi === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = originalApi;
    jest.resetModules();
  });
  test('a static frontend uses the configured API host for wall requests', async () => {
    process.env.VITE_API_BASE_URL = 'https://uploads.example/';
    global.window = { location: { origin: 'https://wall.example' } };
    jest.resetModules();
    const { API_BASE_URL } = await import('../webapp/src/utils/api.js');
    expect(API_BASE_URL).toBe('https://uploads.example');
  });
  test('same-origin browser hosting still works without a configured host', async () => {
    delete process.env.VITE_API_BASE_URL;
    global.window = { location: { origin: 'https://wall.example' } };
    jest.resetModules();
    const { API_BASE_URL } = await import('../webapp/src/utils/api.js');
    expect(API_BASE_URL).toBe('https://wall.example');
  });
});
