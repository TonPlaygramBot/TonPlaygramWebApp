import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

// Read numeric production constants without importing the game's React/server dependencies.
// Unsupported expressions fail closed rather than silently drifting to preview defaults.
export async function readPoolRoyalMetrics() {
  const source = await readFile(new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const definitions = new Map();
  for (const statement of ast.program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'VariableDeclaration') for (const item of declaration.declarations) {
      if (item.id.type === 'Identifier') definitions.set(item.id.name, item.init);
    }
  }
  const evaluate = (node, locals = new Map()) => {
    if (node.type === 'NumericLiteral') return node.value;
    if (node.type === 'Identifier') return locals.has(node.name) ? locals.get(node.name) : evaluate(definitions.get(node.name));
    if (node.type === 'UnaryExpression' && node.operator === '-') return -evaluate(node.argument, locals);
    if (node.type === 'BinaryExpression') {
      const a = evaluate(node.left, locals), b = evaluate(node.right, locals);
      if (node.operator === '+') return a + b;
      if (node.operator === '-') return a - b;
      if (node.operator === '*') return a * b;
      if (node.operator === '/') return a / b;
    }
    if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(p => [p.key.name, evaluate(p.value, locals)]));
    if (node.type === 'MemberExpression') return evaluate(node.object, locals)[node.property.name];
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'MemberExpression' && node.callee.object.name === 'Math' && ['min', 'max'].includes(node.callee.property.name)) {
        return Math[node.callee.property.name](...node.arguments.map(argument => evaluate(argument, locals)));
      }
      if (node.callee.type === 'ArrowFunctionExpression' && node.arguments.length === 0) {
        const scope = new Map(locals);
        for (const statement of node.callee.body.body) {
          if (statement.type === 'VariableDeclaration') for (const item of statement.declarations) scope.set(item.id.name, evaluate(item.init, scope));
          else if (statement.type === 'ReturnStatement') return evaluate(statement.argument, scope);
        }
      }
    }
    throw new Error(`Unsupported Pool Royal metric expression: ${node?.type}`);
  };
  const value = name => evaluate(definitions.get(name));
  const table = value('TABLE');
  return {
    floorY: value('FLOOR_Y'),
    clothY: value('TABLE_Y') + value('CLOTH_TOP_LOCAL') + value('CLOTH_LIFT') - value('CLOTH_DROP'),
    ballY: value('TABLE_Y') + value('BALL_CENTER_Y'), ballR: value('BALL_R'),
    tableW: Math.max(table.W, value('PLAY_W')),
    tableL: Math.max(table.H, value('PLAY_H')),
    playW: value('PLAY_W'), playL: value('PLAY_H'),
    railH: value('RAIL_HEIGHT'), thickness: table.THICK,
    cueLength: 1.5 * (value('BALL_R') / 0.0525) * value('CUE_LENGTH_MULTIPLIER'),
    cueRadius: value('CUE_TIP_RADIUS'), cueGap: value('CUE_TIP_GAP'),
    cuePull: value('CUE_PULL_BASE') * value('CUE_PULL_VISUAL_MULTIPLIER') * value('CUE_PULL_DISTANCE_SCALE') *
      value('CUE_PULL_GLOBAL_VISIBILITY_BOOST') * (1 - value('CUE_PULL_CUE_CAMERA_DAMPING')) * (1 + value('CUE_PULL_ALIGNMENT_BOOST')),
    cueButtLift: value('CUE_BUTT_LIFT')
  };
}
