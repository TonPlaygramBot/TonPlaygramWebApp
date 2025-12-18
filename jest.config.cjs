/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.(ts|tsx|js)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          allowImportingTsExtensions: true,
          allowJs: true
        }
      }
    ]
  }
};
