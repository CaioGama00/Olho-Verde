module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/__tests__/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  verbose: true,
  forceExit: true,
  testTimeout: 10000,
};
