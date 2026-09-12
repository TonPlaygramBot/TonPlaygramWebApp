export type SignReference={id:string;match:RegExp;logo:string;source:string;background:string;foreground:string;crop:[number,number,number,number]|null};
export const SIGN_REFERENCES:readonly SignReference[];
export function signReferenceFor(text:string):SignReference|undefined;
export function referencedAdvertising<S extends {x:number;z:number}>(site:S,storefronts:{x:number;z:number;name:string}[]):S & {name?:string;reference?:string;placementAccuracy?:string};
