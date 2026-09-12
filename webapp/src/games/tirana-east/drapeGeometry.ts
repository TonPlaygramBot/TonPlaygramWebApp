import * as T from 'three';
import {groundHeight,urbanDistance} from './terrainCore.mjs';
export function appendGroundTriangle(out:number[],a:number[],b:number[],c:number[],offset:number,depth=0){
 const raised=[a,b,c].some(p=>urbanDistance(p[0],p[1])>0);
 if(raised&&depth<6&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>12){const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];for(const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])appendGroundTriangle(out,...t as [number[],number[],number[]],offset,depth+1);}
 else for(const p of [a,b,c])out.push(p[0],groundHeight(p[0],p[1])+offset,p[1]);
}
export function drapeGeometry(source:T.BufferGeometry){
 const p=source.getAttribute('position');if(!p)return source;
 let raised=false;for(let i=0;i<p.count;i++)if(urbanDistance(p.getX(i),p.getZ(i))>0){raised=true;break;}if(!raised){if(source.index){const g=source.toNonIndexed();source.dispose();return g;}return source;}
 const g=source.index?source.toNonIndexed():source,pos=g.getAttribute('position'),out:number[]=[];
 for(let i=0;i<pos.count;i+=3)appendGroundTriangle(out,[pos.getX(i),pos.getZ(i)],[pos.getX(i+1),pos.getZ(i+1)],[pos.getX(i+2),pos.getZ(i+2)],pos.getY(i));
 if(g!==source)g.dispose();source.dispose();const geo=new T.BufferGeometry(),uv=[];for(let i=0;i<out.length;i+=3)uv.push(out[i]/5,out[i+2]/5);geo.setAttribute('position',new T.Float32BufferAttribute(out,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;
}
