const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

test('index.html contains root div', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const dom = new JSDOM(html);
  const root = dom.window.document.getElementById('root');
  expect(root).not.toBeNull();
});
