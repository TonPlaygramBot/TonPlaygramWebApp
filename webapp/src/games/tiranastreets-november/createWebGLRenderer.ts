import * as T from 'three';
/** Some mobile drivers reject antialiasing or the high-performance preference.
 * Retry a standard WebGL context before declaring the device unsupported.
 * This does not override the browser's graphics policy or emulate WebGL in 2D.
 */
export function createWebGLRenderer(canvas?:HTMLCanvasElement){
 let cause:unknown;
 for(const antialias of [true,false]){
  try{
   const renderer=new T.WebGLRenderer({canvas,antialias,alpha:false,failIfMajorPerformanceCaveat:false,powerPreference:antialias?'high-performance':'default'});
   renderer.domElement.dataset.graphics=renderer.capabilities.isWebGL2?'WebGL 2':'WebGL';
   return renderer;
  }catch(error){cause=error;}
 }
 throw new Error('WebGL context unavailable on this device',{cause});
}
