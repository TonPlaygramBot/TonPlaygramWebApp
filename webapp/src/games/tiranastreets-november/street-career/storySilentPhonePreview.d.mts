import type {FriendState} from './storyMissingFriendPreview.mjs';
export const SILENT_PHONE_ID:'ch01-silent-phone';
export type PhoneState={stage:'briefing'|'travel'|'review'|'complete';clue:'recording'|'postcard';evidence:'shared-meeting'|null};
type Store=Pick<Storage,'getItem'|'setItem'>;
type Point={x:number;z:number};
type Step={type:'continue'|'accept'}|({type:'position';grounded:boolean;flying:boolean}&Point)|{type:'match';order:'time-place'|'place-time'};
export function readSilentPhonePreview(storage:Store|undefined,prior:FriendState|null):PhoneState|null;
export function saveSilentPhonePreview(storage:Store|undefined,row:PhoneState|null):boolean;
export function stepSilentPhonePreview(row:PhoneState|null,event:Step,prior:FriendState|null,target:Point|null):PhoneState|null;
