export function canWarmCareer(connection: {saveData?: boolean; effectiveType?: string}|undefined,visibility:string): boolean;
export function createSharedCareerLoad<T>(importCareer:()=>Promise<T>):()=>Promise<T>;
