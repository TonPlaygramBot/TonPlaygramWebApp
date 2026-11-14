export type CityAssetByteOptions = {signal?:AbortSignal;reload?:boolean};
export type CityAssetByteCache = {load(url:string,options?:CityAssetByteOptions):Promise<ArrayBuffer>;evict(url:string):void;clear():void;readonly byteLength:number;readonly size:number;readonly activeCount:number};
export function createCityAssetByteCache(options?:{maxBytes?:number;maxEntries?:number;maxActive?:number;ttl?:number;now?:()=>number;fetcher?:typeof fetch}):CityAssetByteCache;
export const cityAssetBytes:CityAssetByteCache;
export function loadCityAssetBytes(url:string,options?:CityAssetByteOptions):Promise<ArrayBuffer>;
