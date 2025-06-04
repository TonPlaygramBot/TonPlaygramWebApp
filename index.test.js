const fs = require('fs');
const path = require('path');

test('index.html contains root div', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  expect(html).toMatch(/<div id="root"><\/div>/);
});
