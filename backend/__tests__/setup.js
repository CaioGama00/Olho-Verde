jest.mock('../db');
jest.mock('../config/env');
jest.mock('axios');

const originalError = console.error;

beforeEach(() => {
  jest.clearAllMocks();
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});
