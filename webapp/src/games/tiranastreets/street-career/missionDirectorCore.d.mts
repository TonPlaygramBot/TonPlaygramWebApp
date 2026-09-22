export type MissionDirector = {version:1;hold:number;extracting:boolean;integrity:number;damageTaken:number;vehicleDamage:number;shotsFired:number;recovery:number;delivered:number;lastHealth:number;lastDamageAt:number;vehicleId:string|null;wasDriving:boolean;lastVehicleHealth:number|null;failure:string};
export type MissionFrame = {health:number;damageAt?:number;paused?:boolean;parcel?:boolean;vehicleId?:string;vehicleHealth?:number;vehicleDestroyed?:boolean;remaining?:number;distance:number;driving?:boolean;onFoot:boolean;grounded:boolean;speed:number;wanted?:number;final?:boolean;firing?:boolean;correctAircraft?:boolean;airborne?:boolean;verticalSpeed?:number};
export function createMissionDirector(raw?:Partial<MissionDirector>):MissionDirector;
export function extractionSeconds(mission:{id:string}):number;
export function updateMissionDirector(director:MissionDirector,mission:{id:string;type:string},frame:MissionFrame,seconds:number):MissionDirector;
export function missionGrade(director:MissionDirector,elapsed:number,limit:number):'gold'|'silver'|'bronze';
