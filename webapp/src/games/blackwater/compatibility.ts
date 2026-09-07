import * as THREE from 'three';
// A bounded Canvas renderer for browsers without WebGL. Uses the same Three.js scene,
// camera and simulation; lower visual detail is explicitly disclosed in the UI.
type Point={x:number;y:number;z:number;u:number;v:number};
type Face={floor:number|null;points:Point[];depth:number;color:string;alpha:number;map:CanvasImageSource|null;};
export class CompatibilityRenderer {
  domElement:HTMLCanvasElement;shadowMap={enabled:false,type:0};outputColorSpace='';toneMapping=0;toneMappingExposure=1;
  private colors=new Map<string,string>();private context:CanvasRenderingContext2D;private width=390;private height=844;private ratio=1;
  constructor(canvas:HTMLCanvasElement){this.domElement=canvas;const c=canvas.getContext('2d',{alpha:false});if(!c)throw new Error('Graphics are unavailable.');this.context=c;}
  setSize(w:number,h:number){this.width=Math.max(1,w);this.height=Math.max(1,h);this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);}
  setPixelRatio(v:number){this.ratio=Math.min(1,v);}
  dispose(){}
  render(scene:THREE.Scene,camera:THREE.PerspectiveCamera){
    const ctx=this.context,w=this.width,h=this.height;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;
    const gradient=ctx.createLinearGradient(0,0,0,h*.65);gradient.addColorStop(0,'#405b69');gradient.addColorStop(.8,'#a4b1af');gradient.addColorStop(1,'#56676a');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    scene.updateMatrixWorld();camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const faces:Face[]=[],viewFaces:Face[]=[],matrix=new THREE.Matrix4(),mv=new THREE.Matrix4(),instance=new THREE.Matrix4(),fog=new THREE.Color('#819496'),light=new THREE.Vector3(-.35,.85,-.65).transformDirection(camera.matrixWorldInverse),frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const focus=h/(2*Math.tan(camera.fov*Math.PI/360));
    const collect=(mesh:THREE.Mesh,world:THREE.Matrix4,viewModel:boolean)=>{
      const geometry=mesh.geometry;if(!geometry.attributes.position)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(mats[0] instanceof THREE.ShaderMaterial||mesh.geometry.type==='SphereGeometry'&&mesh.geometry.boundingSphere&&mesh.geometry.boundingSphere.radius>100)return;
      if(!viewModel&&geometry.type==='BoxGeometry'){const e=world.elements;const sx=Math.hypot(e[0],e[1],e[2]),sy=Math.hypot(e[4],e[5],e[6]),sz=Math.hypot(e[8],e[9],e[10]);const dims=[sx,sy,sz].sort((a,b)=>a-b);if(dims[1]<.23&&dims[2]<14)return;const radius=Math.hypot(sx,sy,sz)*.5;for(const plane of frustum.planes)if(plane.normal.x*e[12]+plane.normal.y*e[13]+plane.normal.z*e[14]+plane.constant < -radius)return;}
      const pos=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index;mv.multiplyMatrices(camera.matrixWorldInverse,world);const e=mv.elements,verts:Point[]=[];
      for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);verts.push({x:e[0]*x+e[4]*y+e[8]*z+e[12],y:e[1]*x+e[5]*y+e[9]*z+e[13],z:e[2]*x+e[6]*y+e[10]*z+e[14],u:uv?uv.getX(i):0,v:uv?uv.getY(i):0});}
      const count=index?index.count:pos.count;
      const boxes=geometry.type==='BoxGeometry';for(let i=0;i<count;i+=boxes?6:3){const a=verts[index?index.getX(i):i],b=verts[index?index.getX(i+1):i+1],c=verts[index?index.getX(i+2):i+2];let points=boxes&&index?[a,b,verts[index.getX(i+4)],c]:[a,b,c];if(points.every(p=>p.z>-.065))continue;
        const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z,acx=c.x-a.x,acy=c.y-a.y,acz=c.z-a.z;let nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;const normalLength=Math.hypot(nx,ny,nz);if(normalLength<.000001)continue;nx/=normalLength;ny/=normalLength;nz/=normalLength;
        let mat=mats[0] as THREE.MeshStandardMaterial; if(mats.length>1){const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);mat=(mats[group?.materialIndex??0]??mats[0]) as THREE.MeshStandardMaterial;}
        if(!mat.visible||mat.opacity===0)continue;if(mat.side!==THREE.DoubleSide&&nx*a.x+ny*a.y+nz*a.z>0)continue;
        if(points.some(p=>p.z>-.065)){const clipped:Point[]=[];for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length],inside=p.z<=-.065,next=q.z<=-.065;if(inside)clipped.push(p);if(inside!==next){const t=(-.065-p.z)/(q.z-p.z);clipped.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:-.065,u:p.u+(q.u-p.u)*t,v:p.v+(q.v-p.v)*t});}}points=clipped;}
        if(points.length<3)continue;const projected=points.map(p=>({x:w/2+p.x*focus/-p.z,y:h/2-p.y*focus/-p.z,z:p.z,u:p.u,v:p.v}));
        if(projected.every(p=>p.x<0)||projected.every(p=>p.x>w)||projected.every(p=>p.y<0)||projected.every(p=>p.y>h))continue;
        const depth=-(a.z+b.z+c.z)/3;const isBasic=mat instanceof THREE.MeshBasicMaterial;const illumination=isBasic?1:(.53+.54*Math.max(0,nx*light.x+ny*light.y+nz*light.z));const colorKey=mat.uuid+':'+Math.round(illumination*15)+':'+(viewModel?0:Math.round(depth/5));let colorStyle=this.colors.get(colorKey);if(!colorStyle){const color=(mat.color??new THREE.Color('#788986')).clone().multiplyScalar(illumination);if(mat.emissive)color.add(mat.emissive.clone().multiplyScalar((mat.emissiveIntensity??1)*.4));if(!viewModel&&depth>8)color.lerp(fog,1-Math.exp(-Math.pow(depth*.014,2)));colorStyle=color.getStyle();if(this.colors.size>6000)this.colors.clear();this.colors.set(colorKey,colorStyle);}
        let map:CanvasImageSource|null=null;if(mat.map?.image&&mat.map.repeat.x===1&&mat.map.repeat.y===1&&geometry.type==='PlaneGeometry')map=mat.map.image as CanvasImageSource;
        const we=world.elements,floor=!viewModel&&we[13]<.16&&Math.hypot(we[4],we[5],we[6])<.5?we[13]:null;
        (viewModel?viewFaces:faces).push({floor,points:projected,depth,color:colorStyle,alpha:mat.opacity??1,map});
      }
    };
    const visit=(o:THREE.Object3D,viewModel=false)=>{if(!o.visible)return;const isView=viewModel||o===camera;if(o instanceof THREE.Mesh){if(!isView&&o.frustumCulled&&!frustum.intersectsObject(o))return;if(o instanceof THREE.InstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);collect(o,matrix,isView);}}else collect(o,o.matrixWorld,isView);}for(const child of o.children)visit(child,isView);};
    visit(scene);const draw=(list:Face[])=>{list.sort((a,b)=>a.floor!==null&&b.floor!==null?a.floor-b.floor||b.depth-a.depth:a.floor!==null?-1:b.floor!==null?1:b.depth-a.depth);for(const face of list){const p=face.points;ctx.globalAlpha=face.alpha;ctx.fillStyle=face.color;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();
      if(face.map&&p.length===3){const img=face.map as HTMLCanvasElement,a=p[0],b=p[1],c=p[2],x0=a.u*img.width,y0=(1-a.v)*img.height,x1=b.u*img.width,y1=(1-b.v)*img.height,x2=c.u*img.width,y2=(1-c.v)*img.height,denom=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);if(Math.abs(denom)>.001){ctx.save();ctx.clip();const aa=(a.x*(y1-y2)+b.x*(y2-y0)+c.x*(y0-y1))/denom,bb=(a.y*(y1-y2)+b.y*(y2-y0)+c.y*(y0-y1))/denom,cc=(a.x*(x2-x1)+b.x*(x0-x2)+c.x*(x1-x0))/denom,dd=(a.y*(x2-x1)+b.y*(x0-x2)+c.y*(x1-x0))/denom,ee=(a.x*(x1*y2-x2*y1)+b.x*(x2*y0-x0*y2)+c.x*(x0*y1-x1*y0))/denom,ff=(a.y*(x1*y2-x2*y1)+b.y*(x2*y0-x0*y2)+c.y*(x0*y1-x1*y0))/denom;ctx.transform(aa,bb,cc,dd,ee,ff);ctx.drawImage(img,0,0);ctx.restore();}}
    }};
    draw(faces);draw(viewFaces);ctx.globalAlpha=1;
  }
}
