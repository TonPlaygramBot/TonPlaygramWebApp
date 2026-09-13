import * as T from 'three';
export const isPocketWeapon=(id:string)=>['punch','egg','tomato'].includes(id);
/** Small shared procedural props require no download or additional renderer. */
export function pocketWeapon(id:string):T.Group {
  const group=new T.Group();group.name=`pocket:${id}`;
  if(id==='punch')return group;
  if(id==='pepper-spray'){
    const can=new T.Mesh(new T.CylinderGeometry(.025,.025,.12,10),new T.MeshStandardMaterial({color:0x25282c,roughness:.55}));
    const cap=new T.Mesh(new T.BoxGeometry(.045,.025,.036),new T.MeshStandardMaterial({color:0xe05a33,roughness:.5}));
    cap.position.set(0,.07,.007);group.add(can,cap);return group;
  }
  const tomato=id==='tomato';
  const fruit=new T.Mesh(new T.SphereGeometry(tomato?.055:.035,12,8),new T.MeshStandardMaterial({color:tomato?0xc94026:0xeee3c9,roughness:.65}));
  if(!tomato)fruit.scale.set(1,1.35,1);
  group.add(fruit);
  if(tomato){const leaf=new T.Mesh(new T.ConeGeometry(.032,.025,5),new T.MeshStandardMaterial({color:0x486a2b,roughness:.9}));leaf.position.y=.052;leaf.rotation.x=Math.PI;group.add(leaf);}
  return group;
}
