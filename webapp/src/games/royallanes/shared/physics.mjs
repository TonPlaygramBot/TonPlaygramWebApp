import * as C from 'cannon-es';
import { createBowlingPhysics } from './physicsCore.mjs';
export * from './physicsCore.mjs';
export const BowlingPhysics = createBowlingPhysics(C);
