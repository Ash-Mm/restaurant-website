/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@restaurant/(db|contracts|config|ui)$': '<rootDir>/../../packages/$1/src/index.ts',
    '^@restaurant/db/migrate$': '<rootDir>/../../packages/db/src/migrate.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: false,
        diagnostics: false,
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/'],
};
