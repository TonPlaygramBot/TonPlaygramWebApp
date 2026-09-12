import {gunzipSync} from './vendor/fflate-gunzip.mjs';

// Synchronous and shared by browser rendering, Node simulation and source tests.
export function decodeSource(parts){
 const binary=atob(parts.join(''));
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return JSON.parse(new TextDecoder().decode(gunzipSync(bytes)));
}
