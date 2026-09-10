export type ReferenceProfile={name:string;style:string;color:number;trim:number;floor:number;window:number;height?:number;flagCountry?:string;category?:string;site?:string;photo:string|null;date:string;source:string;credit:string;features:string};
export const REFERENCE_BUILDINGS:Readonly<Record<string,ReferenceProfile>>;
