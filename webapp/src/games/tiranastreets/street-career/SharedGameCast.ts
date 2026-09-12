import {CHESS_HUMAN_CHARACTER_OPTIONS} from '../../../config/chessBattleInventoryConfig.js';
import {buildSharedGameCast} from './sharedCastCore.mjs';
/** Same source definitions used in Chess Battle Royal and its shared game avatars. */
const cityFaces=Array.from({length:8},(_,i)=>({id:`tirana-citizen-${i}`,label:`Citizen ${i+1}`,url:`/assets/tirana-streets/population/citizen-${i}.glb`,roles:['civilian','gang','dealer'],sourceId:'Blender face variants of bundled RPM character',licence:'Existing Ready Player Me avatar terms retained',height:1.76}));
export const SHARED_GAME_CAST=[...cityFaces,...buildSharedGameCast(CHESS_HUMAN_CHARACTER_OPTIONS)];
