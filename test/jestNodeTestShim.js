import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  test as jestTest
} from '@jest/globals';

const wrapJestTest = (fn) => (name, optionsOrFn, maybeFn) => {
  if (typeof optionsOrFn === 'function') {
    return fn(name, optionsOrFn, maybeFn);
  }
  if (optionsOrFn && typeof maybeFn === 'function') {
    return fn(name, maybeFn, optionsOrFn.timeout);
  }
  return fn(name, optionsOrFn);
};

const test = wrapJestTest(jestTest);
test.skip = wrapJestTest(jestTest.skip);
test.only = wrapJestTest(jestTest.only);

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
