import type {Vec2} from '../core';
import type {BattleMode} from './battlefield.mjs';
export type MissionProgress={progress:number;intel:boolean;extracting:boolean;extraction:number};
export function advanceBattleObjective(state:MissionProgress,frame:{mode:BattleMode;elapsed:number;wave:number;health:number;driving:boolean;lastDamage:number;player:Vec2;center:Vec2;intelPoint:Vec2;extractionPoint:Vec2;enemies:(Vec2&{hp:number})[]},dt:number):MissionProgress&{status:'playing'|'won'|'lost'|'reinforce'|'upgrade';intelSecured:boolean;extractionOpened:boolean};
