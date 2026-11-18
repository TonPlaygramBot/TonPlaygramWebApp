import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as spinExports from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

const source = readFileSync(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const ast = parse(source, {sourceType:'module', plugins:['jsx']});

test('Snooker module initializes cue-tip geometry with its real imported spin bindings', () => {
  const declaration = ast.program.body.find(node => node.type === 'ImportDeclaration' &&
    node.source.value === './snookerRoyalSpinUtils.js');
  const scope = {BALL_R:.05};
  for (const specifier of declaration.specifiers) {
    assert.ok(specifier.imported.name in spinExports, `missing export ${specifier.imported.name}`);
    scope[specifier.local.name] = spinExports[specifier.imported.name];
  }
  const names = ['MAX_SPIN_CONTACT_OFFSET','MAX_SPIN_FORWARD','MAX_SPIN_SIDE','MAX_SPIN_VERTICAL','MAX_SPIN_VISUAL_LIFT'];
  const context = vm.createContext(scope);
  for(const name of names) {
    const declaration = ast.program.body.flatMap(node => node.type === 'VariableDeclaration' ? node.declarations : [])
      .find(node => node.id.name === name);
    const value = vm.runInContext(source.slice(declaration.init.start,declaration.init.end),context);
    assert.ok(Number.isFinite(value), `${name} must initialize without a ReferenceError or NaN`);
    context[name]=value;
  }
  assert.equal(context.MAX_SPIN_CONTACT_OFFSET * spinExports.MAX_SPIN_OFFSET,
    scope.BALL_R * spinExports.MAX_CUE_TIP_OFFSET_RATIO);
});
