module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.json'
      }
    ],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
        plugins: ['@babel/plugin-syntax-import-meta', 'babel-plugin-transform-import-meta']
      }
    ]
  },

  transformIgnorePatterns: ['/node_modules/(?!three/examples/jsm|three/addons)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^node:test$': '<rootDir>/test/jestNodeTestShim.js',
    '^@letele/playing-cards$': '<rootDir>/test/mocks/playingCardsMock.js'
  }
};
