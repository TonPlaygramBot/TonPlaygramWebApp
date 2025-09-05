import fs from 'fs';
import { SnookerRules } from './rules/SnookerRules';
import { Referee } from './core/Referee';
import { ShotEvent } from './types';

const file = process.argv[2] || 'demo/demo.json';
const content: ShotEvent[][] = JSON.parse(fs.readFileSync(file, 'utf-8'));
const rules = new SnookerRules();
const ref = new Referee(rules);
let state = rules.getInitialFrame('Alice', 'Bob');

console.log('Starting frame');
for (const shot of content) {
  state = ref.applyShot(state, shot);
  console.log('Scores:', state.players.A.score, '-', state.players.B.score);
}
console.log('Final:', state.players.A.score, '-', state.players.B.score);
