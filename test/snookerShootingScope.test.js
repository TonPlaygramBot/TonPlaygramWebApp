import fs from 'node:fs';
import { Linter } from 'eslint';

test('the live snooker shot and render callbacks resolve every identifier', () => {
  const source = fs.readFileSync(
    'webapp/src/pages/Games/SnookerRoyal.jsx',
    'utf8'
  );
  const linter = new Linter({ configType: 'eslintrc' });
  const errors = linter.verify(source, {
    env: { browser: true, es2022: true, node: true },
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    },
    rules: { 'no-undef': 'error' }
  });
  expect(errors.map(({ line, message }) => `${line}: ${message}`)).toEqual([]);
});
