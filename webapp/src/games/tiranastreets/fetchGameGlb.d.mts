export function fetchGameGlb(url:string|URL,options?:{
 signal?:AbortSignal;attempts?:number;timeoutMs?:number;maxBytes?:number;onRetry?:(attempt:number)=>void;
}):Promise<ArrayBuffer>;
