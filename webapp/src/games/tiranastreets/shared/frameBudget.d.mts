export function fixedStepBudget(pending:number,delta:number,maxSteps?:number,hz?:number):{steps:number;step:number;remainder:number;dropped:number};
export function nearestActors<T extends {x:number;z:number;id?:string}>(items:readonly T[],viewer:{x:number;z:number}|null|undefined,radius:number,limit:number,eligible?:(entity:T)=>boolean):T[];
