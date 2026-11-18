import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

// Audit the complete modules, not extracted functions with injected bindings.
// This catches omitted imports before a module-level expression can blank a route.
const browserGlobals = new Set(['Audio','Image','URLSearchParams','clearInterval','clearTimeout',
  'document','localStorage','setInterval','window','FileReader','ResizeObserver','TextDecoder',
  'TextEncoder','URL','btoa','console','fetch','performance','requestAnimationFrame','cancelAnimationFrame']);
for (const path of ['webapp/src/pages/Games/SnakeAndLadder.jsx','webapp/src/components/SnakeBoard3D.jsx','webapp/src/utils/ludoSeatedPose.js','webapp/src/utils/ludoParkedWeaponScale.js','webapp/src/utils/ludoCameraPresentation.ts']) {
  test(`${path} has no unbound presentation identifiers`, () => {
    const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
    const missing=new Set();
    traverseModule.default(parse(source,{sourceType:'module',plugins:path.endsWith('.ts')?['typescript']:['jsx']}),{
      ReferencedIdentifier(p) {
        if (p.findParent(parent => parent.isTSType?.() || parent.isTSTypeAliasDeclaration?.() || parent.isTSInterfaceDeclaration?.())) return;
        if(!p.scope.hasBinding(p.node.name) && !browserGlobals.has(p.node.name)) missing.add(p.node.name);
      }
    });
    assert.deepEqual([...missing],[]);
  });
}
