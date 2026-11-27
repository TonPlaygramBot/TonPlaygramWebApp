import {expect,it} from 'vitest';
import {REFERENCE_BUILDINGS} from './profiles.mjs';
import {VILA_31_PROFILE,VILA_31_WAY} from './vila31Profile.mjs';
import {vila31Details} from './Vila31Details';

it('uses only the actual cultural-residence footprint and no invented roof',()=>{
 expect(VILA_31_WAY).toBe('256162004');
 expect(REFERENCE_BUILDINGS[VILA_31_WAY]).toBe(VILA_31_PROFILE);
 expect(REFERENCE_BUILDINGS['470621735']).not.toBe(VILA_31_PROFILE);
 expect(VILA_31_PROFILE).not.toHaveProperty('shellHeight');
 expect(VILA_31_PROFILE).not.toHaveProperty('height');
});
it('lays out the glazed garden tiers and keeps trim within the existing height',()=>{
 const e={a:[-137,720],b:[-117,720],x:-127,z:720,nx:0,nz:1,ux:1,uz:0,length:20,yaw:0};
 const parts:Array<{u:number;y:number;h:number;depth:number;offset?:number;color:number}>=[];
 const ok=vila31Details(VILA_31_PROFILE,[e],15,(_e,color,u,y,_w,h,depth,offset)=>parts.push({color,u,y,h,depth,offset}));
 expect(ok).toBe(true);
 const glass=parts.filter(p=>p.color===0x354349);
 expect(new Set(glass.map(p=>p.y)).size).toBe(3);
 expect(parts.some(p=>p.color===0xe4e2d8&&p.offset===.88)).toBe(true);
 expect(parts.every(p=>p.u>=0&&p.u<=e.length&&p.y-p.h/2>=0&&p.y+p.h/2<=15)).toBe(true);
 expect(vila31Details({...VILA_31_PROFILE,style:'other'},[],15,()=>{})).toBe(false);
});
