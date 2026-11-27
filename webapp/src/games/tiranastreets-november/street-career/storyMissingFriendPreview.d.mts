import type {ReturnState, ReturnOutcome} from './storyReturnPreview.mjs';
export const MISSING_FRIEND_ID: 'ch01-missing-friend';
export type FriendState={stage:'briefing'|'drive'|'arrival'|'complete';branch:ReturnOutcome;clue:'recording'|'postcard'|null};
type Store=Pick<Storage,'getItem'|'setItem'>;
type Point={x:number;z:number};
type Event={type:'continue'|'accept'|'inspect'}|({type:'position';driving:boolean}&Point);
export function readMissingFriendPreview(storage:Store|undefined,prior:ReturnState):FriendState|null;
export function saveMissingFriendPreview(storage:Store|undefined,state:FriendState|null):boolean;
export function stepMissingFriendPreview(state:FriendState|null,event:Event,prior:ReturnState,target:Point|null):FriendState|null;
