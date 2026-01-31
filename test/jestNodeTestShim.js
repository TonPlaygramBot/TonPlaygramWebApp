import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  test as jestTest
} from '@jest/globals';

const wrapTest = (fn) => (name, optionsOrFn, maybeFn) => {
  if (typeof optionsOrFn === 'function') {
    return fn(name, optionsOrFn);
  }
  if (optionsOrFn && typeof optionsOrFn === 'object' && typeof maybeFn === 'function') {
    return fn(name, maybeFn, optionsOrFn.timeout);
  }
  return fn(name, optionsOrFn);
};

const test = wrapTest(jestTest);

test.only = wrapTest(jestTest.only.bind(jestTest));
test.skip = wrapTest(jestTest.skip.bind(jestTest));
test.todo = jestTest.todo.bind(jestTest);

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
