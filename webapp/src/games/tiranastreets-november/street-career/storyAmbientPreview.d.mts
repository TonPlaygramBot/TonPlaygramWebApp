type Kind='roadside'|'safeReturn';
export type StoryAmbientAnchor={id:string;kind:Kind;x:number;z:number};
export type StoryAmbientContext={
  enabled:boolean; ready:boolean; solo:boolean; freeRoam:boolean; missionActive:boolean;
  restricted:boolean; paused:boolean; phase:'day'|'night'|null;
  player:{x:number;z:number;health:number;onFoot?:boolean};
  anchors?:readonly StoryAmbientAnchor[];
};
export type StoryAmbientOffer={
  readonly id:string; readonly kind:Kind; readonly status:'offer'|'accepted';
  readonly title:string; readonly text:string; readonly x:number; readonly z:number; readonly expiresIn:number;
};
export const STORY_AMBIENT_LIMITS: Readonly<{
  firstOffer:number;cooldown:number;offerLife:number;acceptedLife:number;offerMinDistance:number;
  offerMaxDistance:number;retainDistance:number;interactDistance:number;
}>;
export function createStoryAmbientPreview(options?:{
  isAccessible?:(anchor:StoryAmbientAnchor)=>boolean;
}):{
  step(context:StoryAmbientContext,dt:number):StoryAmbientOffer|null;
  act(context:StoryAmbientContext,intent?:{id:string;action:'ignore'|'accept'|'resolve'}):
    StoryAmbientOffer|Readonly<{status:'dismissed';id:string}>|
    Readonly<{status:'resolved';id:string;text:string}>|null;
};
