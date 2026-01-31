import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  test as jestTest
} from '@jest/globals';

const test = (...args) => jestTest(...args);

export default test;
export {
  test,
  it,
  describe,
  beforeAll as before,
  beforeAll,
  afterAll as after,
  afterEach,
  beforeEach,
  afterAll
};
