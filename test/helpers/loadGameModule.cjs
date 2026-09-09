const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
// Execute actual game controllers with injected platform boundaries. This is not
// a WebGL/browser test; geometry and network transports must be tested separately.
exports.loadGameModule = function(file, mocks = {}, globals = {}) {
  const filename = path.resolve(file);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} }, actualRequire = createRequire(filename);
  const context = { module, exports: module.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : actualRequire(name),
    console, crypto: globalThis.crypto, Date, URL, Math, Promise,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, ...globals };
  vm.runInNewContext(js, context, { filename });
  return module.exports;
};
