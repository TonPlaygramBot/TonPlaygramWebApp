export class GameInput {
  keys=new Set<string>();move={x:0,y:0};firing=false;aiming=false;crouching=false;active=false;
  onLook:(dx:number,dy:number)=>void=()=>{};onFire:()=>void=()=>{};onReload:()=>void=()=>{};onPause:()=>void=()=>{};onHeal:()=>void=()=>{};
  private cleanup:(()=>void)[]=[];private pointer:number|null=null;private last={x:0,y:0};
  constructor(private surface:HTMLElement){
    const on=(target:EventTarget,name:string,fn:EventListener)=>{target.addEventListener(name,fn);this.cleanup.push(()=>target.removeEventListener(name,fn));};
    on(window,'keydown',((e:KeyboardEvent)=>{if(!this.active)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.repeat)return;if(e.code==='KeyF')this.onFire();if(e.code==='KeyR')this.onReload();if(e.code==='Escape'||e.code==='KeyP')this.onPause();if(e.code==='KeyC')this.crouching=!this.crouching;if(e.code==='KeyE')this.onHeal();if(e.code==='KeyQ')this.aiming=!this.aiming;}) as EventListener);
    on(window,'keyup',((e:KeyboardEvent)=>{this.keys.delete(e.code);if(e.code==='KeyF')this.firing=false;}) as EventListener);
    on(window,'blur',(()=>{if(this.active)this.onPause();this.clear();}) as EventListener);
    on(document,'visibilitychange',(()=>{if(document.hidden&&this.active)this.onPause();}) as EventListener);
    on(surface,'contextmenu',((e:Event)=>e.preventDefault()) as EventListener);
    on(surface,'pointerdown',((e:PointerEvent)=>{if(!this.active)return;this.pointer=e.pointerId;this.last={x:e.clientX,y:e.clientY};surface.setPointerCapture(e.pointerId);if(e.pointerType==='mouse'){if(e.button===0){this.firing=true;this.onFire();}if(e.button===2)this.aiming=true;}}) as EventListener);
    on(surface,'pointermove',((e:PointerEvent)=>{if(!this.active)return;if(document.pointerLockElement===surface){this.onLook(e.movementX,e.movementY);return;}if(e.pointerId!==this.pointer)return;this.onLook(e.clientX-this.last.x,e.clientY-this.last.y);this.last={x:e.clientX,y:e.clientY};}) as EventListener);
    const end=(e:PointerEvent)=>{if(e.pointerId===this.pointer){this.pointer=null;this.firing=false;if(e.pointerType==='mouse')this.aiming=false;}};
    on(surface,'pointerup',end as EventListener);on(surface,'pointercancel',end as EventListener);on(surface,'lostpointercapture',end as EventListener);
    on(document,'pointerlockchange',(()=>{if(!document.pointerLockElement&&this.active)this.onPause();}) as EventListener);
  }
  clear(){this.keys.clear();this.move={x:0,y:0};this.firing=false;this.aiming=false;this.pointer=null;}
  lock(){try{const result=this.surface.requestPointerLock?.();if(result)void result.catch(()=>{});}catch{ /* Drag aiming remains available. */ }}
  dispose(){this.cleanup.forEach(f=>f());this.clear();}
}
