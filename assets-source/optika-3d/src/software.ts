import * as T from 'three';
import {Mission} from './data';
// The software path runs the same Three scene graph and skinned GLB animations on previews without a graphics context.
type Mip={w:number;h:number;pixels:Uint8ClampedArray};
type Surface={levels:Mip[];r:number;g:number;b:number;alpha:number;double:boolean;sky:boolean;unlit:boolean;transparent:boolean};
type Batch={base:Float32Array;cache:Float32Array;screen:Float32Array;indices:Uint32Array;bones:Float32Array|null;weights:Float32Array|null;n:number;fixed:boolean};
type Shadow={matrix:number[];depthSpan:number;size:number;pixels:Uint16Array};
const STRIDE=11,C=14,clamp=(x:number,a:number,b:number)=>x<a?a:x>b?b:x;
const srgb=(v:number)=>Math.round(Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))*255);
function pack(r:number,g:number,b:number){return (255<<24)|((b&255)<<16)|((g&255)<<8)|(r&255)}
function skyTexture(level:Mission){
 const w=1024,h=448,can=document.createElement('canvas');can.width=w;can.height=h;const ctx=can.getContext('2d')!,img=ctx.createImageData(w,h),p=img.data;
 const col=(n:number)=>[(n>>16)&255,(n>>8)&255,n&255],top=col(level.sky[0]),horizon=col(level.sky[1]),warm=col(level.sky[2]);
 const sun=new T.Vector3(...level.sunDirection).normalize();
 const hash=(x:number,y:number)=>{const t=Math.sin(x*127.1+y*311.7)*43758.5453;return t-Math.floor(t)};
 const noise=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v};
 for(let j=0;j<h;j++){const elev=(.5-j/(h-1))*Math.PI,ny=Math.sin(elev),rad=Math.cos(elev),v=clamp(ny,0,1),mix=v**.55;
  for(let i=0;i<w;i++){const t=i/(w-1)*Math.PI*2,nx=-Math.cos(t)*rad,nz=Math.sin(t)*rad,light=Math.max(0,nx*sun.x+ny*sun.y+nz*sun.z);
   const xx=nx/(v+.15)*2,yy=nz/(v+.15)*2;let n=noise(xx,yy)*.51+noise(xx*2.02+7,yy*2.02-9)*.28+noise(xx*4.08,yy*4.08+11)*.14+noise(xx*8.4+3,yy*8.4)*.07;
   const d=clamp((n-(level.weather==='rain'?.36:.47))*3.4,0,.89)*clamp((ny+.04)*6,0,1);const gl=light**4*.29,bright=light**2400;
   for(let c=0;c<3;c++){let base=(horizon[c]*(1-mix)+top[c]*mix)*(1-gl)+warm[c]*gl;const clouds=horizon[c]*(.76+n*.30)+light**3*28; p[(j*w+i)*4+c]=base*(1-d)+clouds*d+bright*(1-d)*100}p[(j*w+i)*4+3]=255
  }}ctx.putImageData(img,0,0);const tex=new T.CanvasTexture(can);tex.colorSpace=T.SRGBColorSpace;return tex;
}
export class SoftwareRenderer{
 readonly domElement=document.createElement('canvas');readonly shadowMap={enabled:false,type:T.PCFSoftShadowMap};outputColorSpace=T.SRGBColorSpace;toneMapping=T.NoToneMapping;toneMappingExposure=1;
 private ctx=this.domElement.getContext('2d',{alpha:false})!;private w=1;private h=1;private image=this.ctx.createImageData(1,1);private rgb=new Uint32Array(1);private z=new Float32Array(1);private ratio=1;private cssW=1;private cssH=1;
 private geo=new WeakMap<T.BufferGeometry,Batch>();private materials=new WeakMap<T.Material,Surface>();private textures=new WeakMap<T.Texture,Mip[]>();private shadow:Shadow|null=null;private meshes:T.Mesh[]=[];private transparent:T.Mesh[]=[];
 private sky:T.Mesh;private sun:T.Vector3;private haze:number[];private fogLut=new Float32Array(512);private view=new T.Matrix4();private bonesTemp=new Float32Array(16*256);
 private a=new Float32Array(C*6);private b=new Float32Array(C*6);private cacheMat=new T.Matrix4();private disposed=false;
 constructor(private level:Mission){
   this.domElement.style.imageRendering='auto';this.sun=new T.Vector3(...level.sunDirection).normalize();this.haze=[(level.haze>>16)&255,(level.haze>>8)&255,level.haze&255];
   for(let i=0;i<512;i++)this.fogLut[i]=1-Math.exp(-Math.pow((level.id==='harbor'?.0105:.007)*i,2));
   const s=new T.MeshBasicMaterial({map:skyTexture(level),side:T.BackSide});s.name='sky-vault';this.sky=new T.Mesh(new T.SphereGeometry(235,48,24),s);this.sky.scale.set(1,1,1);
   this.initShadow();
 }
 private async initShadow(){try{const [manifest,file]=await Promise.all([fetch('worlds/light/shadow.json').then(r=>r.json()),fetch('worlds/light/'+this.level.id+'.bin').then(r=>r.arrayBuffer())]);if(!this.disposed)this.shadow={...manifest.maps[this.level.id],size:manifest.size,pixels:new Uint16Array(file)}}catch{}}
 setPixelRatio(r:number){this.ratio=r;this.setSize(this.cssW,this.cssH)}
 setSize(w:number,h:number,_css=false){this.cssW=w;this.cssH=h;const scale=Math.min(1,Math.sqrt((w/h<.9?230000:330000)/(w*h)))*Math.min(1,this.ratio);this.w=Math.max(1,Math.round(w*scale));this.h=Math.max(1,Math.round(h*scale));this.domElement.width=this.w;this.domElement.height=this.h;this.image=this.ctx.createImageData(this.w,this.h);this.rgb=new Uint32Array(this.image.data.buffer);this.z=new Float32Array(this.w*this.h)}
 private texture(tex:T.Texture){
   const old=this.textures.get(tex);if(old)return old;const im=tex.image as CanvasImageSource&{width:number;height:number};const levels:Mip[]=[];if(!im?.width)return levels;
   const scale=Math.min(1,768/Math.max(im.width,im.height));let w=Math.max(1,Math.round(im.width*scale)),h=Math.max(1,Math.round(im.height*scale));let src=im as CanvasImageSource;
   for(let k=0;k<11;k++){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;
     if(k===0&&tex.flipY&&tex!==((this.sky.material as T.MeshBasicMaterial).map)){ctx.translate(0,h);ctx.scale(1,-1)}ctx.drawImage(src,0,0,w,h);
     levels.push({w,h,pixels:ctx.getImageData(0,0,w,h).data});src=c;if(w<3&&h<3)break;w=Math.max(1,w>>1);h=Math.max(1,h>>1)}
   this.textures.set(tex,levels);return levels;
 }
 private surface(m:T.Material){
   let s=this.materials.get(m);if(s)return s;const mat=m as T.MeshStandardMaterial,col=mat.color??new T.Color(1,1,1);
   s={levels:mat.map?this.texture(mat.map):[],r:srgb(col.r)/255,g:srgb(col.g)/255,b:srgb(col.b)/255,alpha:Math.max(4,(m.alphaTest||0)*255),double:m.side!==T.FrontSide,sky:m.name==='sky-vault',unlit:m instanceof T.MeshBasicMaterial,transparent:m.transparent&&m.opacity<.95};
   if(s.sky)s.r=s.g=s.b=1;this.materials.set(m,s);return s;
 }
 private batch(g:T.BufferGeometry):Batch{
   const old=this.geo.get(g);if(old)return old;const pos=g.attributes.position,norm=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,skin=g.attributes.skinIndex,weights=g.attributes.skinWeight;
   const n=pos.count,base=new Float32Array(n*STRIDE),bones=skin?new Float32Array(n*4):null,wt=weights?new Float32Array(n*4):null;
   for(let i=0;i<n;i++){const k=i*STRIDE;base[k]=pos.getX(i);base[k+1]=pos.getY(i);base[k+2]=pos.getZ(i);base[k+3]=norm?.getX(i)??0;base[k+4]=norm?.getY(i)??1;base[k+5]=norm?.getZ(i)??0;base[k+6]=uv?.getX(i)??0;base[k+7]=uv?.getY(i)??0;base[k+8]=color?srgb(color.getX(i))/255:1;base[k+9]=color?srgb(color.getY(i))/255:1;base[k+10]=color?srgb(color.getZ(i))/255:1;
    if(skin&&weights&&bones&&wt){for(let j=0;j<4;j++){bones[i*4+j]=skin.getComponent(i,j)*16;wt[i*4+j]=weights.getComponent(i,j)}}}
   const indices=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:n},(_,i)=>i);
   const b={base,cache:new Float32Array(n*C),screen:new Float32Array(n*C),indices,bones,weights:wt,n,fixed:false};this.geo.set(g,b);return b;
 }
 private draw(mesh:T.Mesh){
   const g=mesh.geometry;if(!g?.attributes.position?.count)return;
   const batch=this.batch(g),base=batch.base,v=batch.screen,W=mesh.matrixWorld.elements,P=this.view.elements,shadow=this.shadow,sm=shadow?.matrix;
   const s=mesh as T.SkinnedMesh;let bm:Float32Array|undefined;
   if(s.isSkinnedMesh&&batch.bones){s.skeleton.update();const count=s.skeleton.bones.length;const out=this.bonesTemp;
     for(let j=0;j<count;j++){this.cacheMat.fromArray(s.skeleton.boneMatrices,j*16).multiply(s.bindMatrix).premultiply(s.bindMatrixInverse);this.cacheMat.toArray(out,j*16)}bm=out}
   const matList=Array.isArray(mesh.material)?mesh.material:[mesh.material];const sky=mesh===this.sky;const constant=mesh.userData.softwareStatic===true;
   const xSun=this.sun.x,ySun=this.sun.y,zSun=this.sun.z,cache=batch.cache;
   const prepare=!constant||!batch.fixed;let lx=0,ly=0,lz=0,light=1;
   for(let i=0;i<batch.n;i++){const p=i*STRIDE,k=i*C;
    if(prepare){let x=base[p],y=base[p+1],z=base[p+2],nx=base[p+3],ny=base[p+4],nz=base[p+5];
     if(bm&&batch.bones&&batch.weights){let xx=0,yy=0,zz=0,ax=0,ay=0,az=0;for(let j=i*4;j<i*4+4;j++){let w=batch.weights[j];if(!w)continue;let b=batch.bones[j];xx+=w*(bm[b]*x+bm[b+4]*y+bm[b+8]*z+bm[b+12]);yy+=w*(bm[b+1]*x+bm[b+5]*y+bm[b+9]*z+bm[b+13]);zz+=w*(bm[b+2]*x+bm[b+6]*y+bm[b+10]*z+bm[b+14]);ax+=w*(bm[b]*nx+bm[b+4]*ny+bm[b+8]*nz);ay+=w*(bm[b+1]*nx+bm[b+5]*ny+bm[b+9]*nz);az+=w*(bm[b+2]*nx+bm[b+6]*ny+bm[b+10]*nz)}x=xx;y=yy;z=zz;nx=ax;ny=ay;nz=az}
     lx=W[0]*x+W[4]*y+W[8]*z+W[12];ly=W[1]*x+W[5]*y+W[9]*z+W[13];lz=W[2]*x+W[6]*y+W[10]*z+W[14];
     const ax=W[0]*nx+W[4]*ny+W[8]*nz,ay=W[1]*nx+W[5]*ny+W[9]*nz,az=W[2]*nx+W[6]*ny+W[10]*nz;
     const inv=1/(Math.sqrt(ax*ax+ay*ay+az*az)||1);const diffuse=Math.max(0,(ax*xSun+ay*ySun+az*zSun)*inv);
     light=sky?1:.65+.14*(ay*inv+1)*.5+.32*diffuse;
     cache[k]=lx;cache[k+1]=ly;cache[k+2]=lz;cache[k+3]=base[p+6];cache[k+4]=sky?1-base[p+7]:base[p+7];
     cache[k+5]=base[p+8]*light;cache[k+6]=base[p+9]*light;cache[k+7]=base[p+10]*light;
     cache[k+11]=diffuse;cache[k+12]=0;
    }else{lx=cache[k];ly=cache[k+1];lz=cache[k+2]}
    if(sm&&(!constant||!batch.fixed||cache[k+12]===0)){
     cache[k+8]=sm[0]*lx+sm[4]*ly+sm[8]*lz+sm[12];cache[k+9]=sm[1]*lx+sm[5]*ly+sm[9]*lz+sm[13];cache[k+10]=sm[2]*lx+sm[6]*ly+sm[10]*lz+sm[14]-(.24+.31*(1-cache[k+11]))/shadow!.depthSpan;cache[k+12]=1;
    }
    const x=P[0]*lx+P[4]*ly+P[8]*lz+P[12],y=P[1]*lx+P[5]*ly+P[9]*lz+P[13],w=P[3]*lx+P[7]*ly+P[11]*lz+P[15];
    v[k]=x;v[k+1]=y;v[k+2]=w;for(let j=3;j<11;j++)v[k+j]=cache[k+j];
    if(w>=.035){const iw=1/w;v[k+11]=(x*iw*.5+.5)*this.w;v[k+12]=(.5-y*iw*.5)*this.h;v[k+13]=iw}
   }
   if(constant)batch.fixed=true;const inds=batch.indices,groups=Array.isArray(mesh.material)?g.groups:[{start:0,count:inds.length,materialIndex:0}];
   for(const grp of groups){const mat=matList[grp.materialIndex??0];if(!mat||!mat.visible||mat.opacity<.07)continue;const surf=this.surface(mat);
    for(let j=grp.start,end=Math.min(inds.length,grp.start+grp.count);j<end;j+=3){let k0=inds[j]*C,k1=inds[j+1]*C,k2=inds[j+2]*C;
     const w0=v[k0+2],w1=v[k1+2],w2=v[k2+2];if(w0<.035&&w1<.035&&w2<.035)continue;
     if(w0>=.035&&w1>=.035&&w2>=.035){this.tri(v,k0,k1,k2,surf,mat.opacity)}else this.clip(v,k0,k1,k2,surf,mat.opacity);
    }}
 }
 private clip(v:Float32Array,k0:number,k1:number,k2:number,s:Surface,opacity:number){
   const a=this.a,b=this.b;let count=0;
   for(let j=0;j<3;j++){const k=j===0?k0:j===1?k1:k2;for(let t=0;t<11;t++)a[j*C+t]=v[k+t]}
   for(let i=0;i<3;i++){const p=((i+2)%3)*C,q=i*C;const d=a[p+2],e=a[q+2];if((d>=.035)!==(e>=.035)){const f=(.035-d)/(e-d),n=count++*C;for(let t=0;t<11;t++)b[n+t]=a[p+t]+f*(a[q+t]-a[p+t])}if(e>=.035){const n=count++*C;for(let t=0;t<11;t++)b[n+t]=a[q+t]}}
   for(let i=0;i<count;i++){const k=i*C,iw=1/b[k+2];b[k+11]=(b[k]*iw*.5+.5)*this.w;b[k+12]=(.5-b[k+1]*iw*.5)*this.h;b[k+13]=iw}
   for(let i=1;i<count-1;i++)this.tri(b,0,i*C,(i+1)*C,s,opacity);
 }
 private tri(v:Float32Array,k0:number,k1:number,k2:number,s:Surface,opacity:number){
   const x0=v[k0+11],y0=v[k0+12],x1=v[k1+11],y1=v[k1+12],x2=v[k2+11],y2=v[k2+12];
   const area=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(area)<.08||(!s.double&&area>0))return;
   const minX=Math.max(0,Math.ceil(Math.min(x0,x1,x2)-.5)),maxX=Math.min(this.w-1,Math.floor(Math.max(x0,x1,x2)-.5)),minY=Math.max(0,Math.ceil(Math.min(y0,y1,y2)-.5)),maxY=Math.min(this.h-1,Math.floor(Math.max(y0,y1,y2)-.5));if(minX>maxX||minY>maxY)return;
   const inv=1/area,da=(y1-y2)*inv,db=(y2-y0)*inv,ea=(x2-x1)*inv,eb=(x0-x2)*inv;
   let ar=((x1-minX-.5)*(y2-minY-.5)-(y1-minY-.5)*(x2-minX-.5))*inv,br=((x2-minX-.5)*(y0-minY-.5)-(y2-minY-.5)*(x0-minX-.5))*inv;
   const z0=v[k0+13],z1=v[k1+13],z2=v[k2+13];
   const l=s.levels;let mip=l[0];if(mip&&l.length>1&&!s.sky){const uv=Math.abs((v[k1+3]-v[k0+3])*(v[k2+4]-v[k0+4])-(v[k1+4]-v[k0+4])*(v[k2+3]-v[k0+3]));const lev=clamp(Math.floor(.5*Math.log2(uv*mip.w*mip.h/Math.abs(area)+.00001)),0,l.length-1);mip=l[lev]}
   const fog=this.fogLut,haze=this.haze,shadow=this.shadow,sh=shadow?.pixels,shSize=shadow?.size??0,dest=this.rgb,depth=this.z,tw=mip?.w??1,th=mip?.h??1,texture=mip?.pixels;
   const k0u=v[k0+3],k1u=v[k1+3],k2u=v[k2+3],k0v=v[k0+4],k1v=v[k1+4],k2v=v[k2+4];
   const r0=v[k0+5],r1=v[k1+5],r2=v[k2+5],g0=v[k0+6],g1=v[k1+6],g2=v[k2+6],b0=v[k0+7],b1=v[k1+7],b2=v[k2+7];
   const fx0=v[k0+8],fx1=v[k1+8],fx2=v[k2+8],fy0=v[k0+9],fy1=v[k1+9],fy2=v[k2+9],fz0=v[k0+10],fz1=v[k1+10],fz2=v[k2+10];
   for(let y=minY;y<=maxY;y++,ar+=ea,br+=eb){let a=ar,b=br;for(let x=minX,idx=y*this.w+x;x<=maxX;x++,idx++,a+=da,b+=db){const c=1-a-b;if(a<-.00001||b<-.00001||c<-.00001)continue;
      let p0=a*z0,p1=b*z1,p2=c*z2;const iz=p0+p1+p2;if(iz<=depth[idx])continue;const dist=1/iz;p0*=dist;p1*=dist;p2*=dist;
      let rr=255,gg=255,bb=255,alpha=opacity;
      if(texture){let u=p0*k0u+p1*k1u+p2*k2u,t=p0*k0v+p1*k1v+p2*k2v;u-=Math.floor(u);t-=Math.floor(t);const fx=u*tw,fy=t*th,ix=fx|0,iy=fy|0,off=(iy*tw+ix)*4;if(texture[off+3]<s.alpha)continue;rr=texture[off];gg=texture[off+1];bb=texture[off+2];alpha*=texture[off+3]/255;
        if(s.sky||(tw>=64&&dist<48)){const ax=fx-ix,ay=fy-iy,xn=(ix+1)%tw,yn=(iy+1)%th,k1=(iy*tw+xn)*4,k2=(yn*tw+ix)*4,k3=(yn*tw+xn)*4;rr=(rr*(1-ax)+texture[k1]*ax)*(1-ay)+(texture[k2]*(1-ax)+texture[k3]*ax)*ay;gg=(gg*(1-ax)+texture[k1+1]*ax)*(1-ay)+(texture[k2+1]*(1-ax)+texture[k3+1]*ax)*ay;bb=(bb*(1-ax)+texture[k1+2]*ax)*(1-ay)+(texture[k2+2]*(1-ax)+texture[k3+2]*ax)*ay}}
      if(!s.sky){let shadowMul=1;if(sh&&!s.unlit){let sx=(p0*fx0+p1*fx1+p2*fx2)*shSize-.5,sy=(p0*fy0+p1*fy1+p2*fy2)*shSize-.5;if(sx>=0&&sy>=0&&sx<shSize-1&&sy<shSize-1){const dd=(p0*fz0+p1*fz1+p2*fz2)*65535,ix=sx|0,iy=sy|0,k=iy*shSize+ix,tx=sx-ix,ty=sy-iy;shadowMul=1-.34*((dd>sh[k]?(1-tx)*(1-ty):0)+(dd>sh[k+1]?tx*(1-ty):0)+(dd>sh[k+shSize]?(1-tx)*ty:0)+(dd>sh[k+shSize+1]?tx*ty:0))}}
        const f=fog[Math.min(511,dist|0)];rr=rr*s.r*(p0*r0+p1*r1+p2*r2)*shadowMul*(1-f)+haze[0]*f;gg=gg*s.g*(p0*g0+p1*g1+p2*g2)*shadowMul*(1-f)+haze[1]*f;bb=bb*s.b*(p0*b0+p1*b1+p2*b2)*shadowMul*(1-f)+haze[2]*f}
      if(alpha<.99){const old=dest[idx];rr=rr*alpha+(old&255)*(1-alpha);gg=gg*alpha+((old>>>8)&255)*(1-alpha);bb=bb*alpha+((old>>>16)&255)*(1-alpha)}
      dest[idx]=pack(Math.min(255,rr),Math.min(255,gg),Math.min(255,bb));if(alpha>.4)depth[idx]=iz;
   }}
 }
 render(scene:T.Scene,camera:T.PerspectiveCamera){
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();this.view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.rgb.fill(pack(...this.haze as [number,number,number]));this.z.fill(0);
    this.sky.position.copy(camera.position);this.sky.updateMatrixWorld();this.draw(this.sky);
    this.meshes.length=this.transparent.length=0;scene.traverseVisible(o=>{if(o instanceof T.Mesh&&!(o.material instanceof T.ShaderMaterial)){if(o.material.transparent)this.transparent.push(o);else this.meshes.push(o)}});
    for(const o of this.meshes)this.draw(o);for(const o of this.transparent)this.draw(o);
    this.ctx.putImageData(this.image,0,0);
    scene.traverseVisible(o=>{if(!(o instanceof T.Points))return;const p=o.geometry.attributes.position,pt=new T.Vector3();this.ctx.fillStyle=this.level.weather==='snow'?'rgba(255,255,255,.45)':'rgba(203,218,221,.21)';for(let i=0;i<p.count;i++){pt.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera);if(pt.z<0||pt.z>1||Math.abs(pt.x)>1||Math.abs(pt.y)>1)continue;this.ctx.fillRect((pt.x*.5+.5)*this.w,(.5-pt.y*.5)*this.h,1,this.level.weather==='snow'?1.6:4)}})
 }
 dispose(){this.disposed=true;this.sky.geometry.dispose();(this.sky.material as T.MeshBasicMaterial).map?.dispose();(this.sky.material as T.Material).dispose()}
 forceContextLoss(){}
}
