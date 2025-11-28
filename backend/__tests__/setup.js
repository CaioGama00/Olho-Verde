jest.mock("../db");
jest.mock("../config/env");
jest.mock("axios");

const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  jest.clearAllMocks();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});
