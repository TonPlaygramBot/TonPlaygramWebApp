import * as T from 'three';
export type BlenderParts={parts:{material:string;color:number[];positions:number[];normals:number[]}[]};
/** Vertices are evaluated in Blender, in metres and converted to Three's Y-up. */
export function blenderGroup(data:BlenderParts) {
  const group=new T.Group();
  for(const part of data.parts){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(part.normals,3));
    geometry.computeBoundingSphere();
    const material=new T.MeshStandardMaterial({color:new T.Color(...part.color as [number,number,number]),roughness:part.material==='glass'?.3:.78,metalness:part.material==='gold'?.75:0});
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
export function coloredGeometry(data:BlenderParts){
  const positions:number[]=[],normals:number[]=[],colors:number[]=[];
  for(const p of data.parts){positions.push(...p.positions);normals.push(...p.normals);for(let i=0;i<p.positions.length;i+=3)colors.push(...p.color);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingSphere();return g;
}
