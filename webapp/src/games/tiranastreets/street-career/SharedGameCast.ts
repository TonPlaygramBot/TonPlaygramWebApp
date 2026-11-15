import {CHESS_HUMAN_CHARACTER_OPTIONS} from '../../../config/chessBattleInventoryConfig.js';
import {TURI_MODEL_URL} from '../../../config/playerCharacter.js';
import {buildSharedGameCast} from './sharedCastCore.mjs';
/** Same source definitions used in Chess Battle Royal and its shared game avatars. */
const cityFaces=Array.from({length:8},(_,i)=>({id:`tirana-citizen-${i}`,label:`Citizen ${i+1}`,url:`/assets/tirana-streets/population/citizen-${i}.glb`,roles:['civilian','gang','dealer'],sourceId:'Blender face variants of bundled RPM character',licence:'Existing Ready Player Me avatar terms retained',height:1.76}));
const turi={id:'turi',label:'Turi',url:TURI_MODEL_URL,roles:['civilian','gang','dealer'],sourceId:'turi',licence:'Existing Turi asset terms retained',height:1.75};
export const SHARED_GAME_CAST=[turi,...cityFaces,...buildSharedGameCast(CHESS_HUMAN_CHARACTER_OPTIONS)];
