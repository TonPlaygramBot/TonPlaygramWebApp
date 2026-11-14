import type {Track,Racer} from './simulation.mjs';
import type {DrivingWorld} from './freeRoamCore.mjs';
export interface ActionInput {moveX:number;moveZ:number;turn:number;sprint:boolean;fire:boolean;jump:boolean;interact:boolean;reload:boolean;jumpPressed?:boolean;interactPressed?:boolean}
export interface ActionMission {id:string;title:string;district:string;track:string;kind:'recovery'|'sabotage'|'rescue';unlock:number;xp:number;seconds:number;drive:number;guards:number;brief:string}
export interface ActionCareerProfile {version:1;medals:Record<string,number>;best:Record<string,number>}
export interface ActionPoint {x:number;z:number;yaw:number;groundY:number;index?:number;distance?:number}
export interface ActionActor extends ActionPoint {jumpHeight:number;jumpVelocity:number;speed:number;health:number;stamina:number;exhausted:boolean}
export interface ActionEnemy extends ActionPoint {id:string;health:number;cooldown:number;warning:number;aimX:number;aimZ:number;firedAt:number;sightCooldown:number;sightX:number;sightZ:number;hasSight:boolean}
export interface ActionShot {id:number;x:number;z:number;y:number;toX:number;toZ:number;toY:number;at:number;enemy:boolean;hit:boolean}
export interface ActionProjectile {id:number;x:number;z:number;y:number;dx:number;dz:number;ttl:number}
export interface ActionCareerState {
 id:string;status:'active'|'complete'|'failed';mode:'driving'|'onfoot';stage:'drive'|'clear'|'collect'|'return'|'extract';
 objective:string;elapsed:number;seconds:number;reason:string;medal:number;distance:number;
 actor:ActionActor;park:ActionPoint;package:ActionPoint;extraction:ActionPoint;
 ammo:number;reserve:number;reload:number;fireCooldown:number;firedAt:number;interactHeld:boolean;jumpHeld:boolean;
 collected:boolean;staged:boolean;driveDistance:number;extractionHold:number;footDistance:number;kills:number;hitId:number;
 shots:ActionShot[];projectiles:ActionProjectile[];shotId:number;previous:{x:number;z:number};recoveryAt:number;progressBlocked:number;enemies:ActionEnemy[];
}
export const ACTION_CAREER_KEY:string;
export const ACTION_MISSIONS:readonly ActionMission[];
export function neutralActionInput():ActionInput;
export function freshActionCareer():ActionCareerProfile;
export function normalizeActionCareer(raw:unknown):ActionCareerProfile;
export function actionCareerXP(profile:ActionCareerProfile):number;
export function loadActionCareer(storage?:Pick<Storage,'getItem'>):ActionCareerProfile;
export function saveActionCareer(storage:Pick<Storage,'setItem'>|undefined,profile:ActionCareerProfile):boolean;
export function createActionCareer(id:string,track:Track,racer:Racer,world?:DrivingWorld|null):ActionCareerState;
export function stepActionCareer(state:ActionCareerState,racer:Racer,input:ActionInput,dt:number,world?:DrivingWorld|null):ActionCareerState;
export function finishActionCareer(profile:ActionCareerProfile,state:ActionCareerState):{profile:ActionCareerProfile;xp:number};
export function actionLineClear(world:DrivingWorld|null|undefined,from:{x:number;z:number},to:{x:number;z:number}):boolean;
export function actionCameraDistance(world:DrivingWorld|null|undefined,actor:{x:number;z:number},yaw:number,desired?:number):number;
