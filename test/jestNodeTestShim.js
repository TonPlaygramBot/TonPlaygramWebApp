import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  test as jestTest
} from '@jest/globals';

const wrapJestTest = (fn) => (name, optionsOrFn, maybeFn, maybeTimeout) => {
  if (typeof optionsOrFn === 'function') {
    return fn(name, optionsOrFn, maybeFn);
  }
  if (optionsOrFn && typeof optionsOrFn === 'object' && typeof maybeFn === 'function') {
    return fn(name, maybeFn, optionsOrFn.timeout ?? maybeTimeout);
  }
  return fn(name, optionsOrFn, maybeFn);
};

const test = wrapJestTest(jestTest);

test.skip = wrapJestTest(jestTest.skip);
test.only = wrapJestTest(jestTest.only);
test.todo = jestTest.todo;
test.concurrent = wrapJestTest(jestTest.concurrent);

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
