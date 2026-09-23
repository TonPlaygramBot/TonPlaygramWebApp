import {appendBuildingShell,shellGeometry} from '../tirana-neighbourhood/buildingShell';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {panoramaBlend,panoramaVisible} from './panoramaCore.mjs';

/** Distant LOD of the SAME mapped footprints. No fabricated outer-city blocks.
 * This layer never expands the camera range or adds scenery outside the city. */
export class RegionalPanorama {
  readonly group=new T.Group();
  private built=false;
  private materials:T.MeshBasicMaterial[]=[];
  constructor(){
    this.group.name='Tirana:regional-panorama';this.group.visible=false;
    this.group.userData={source:WORLD.source,
      accuracy:'Retained urban source footprints >= 8 m at distance; no rural or coastal scenery.',runtimeReady:true};
  }
  private material(color:number){
    const m=new T.MeshBasicMaterial({color,fog:false,transparent:true,opacity:0,depthWrite:false});
    this.materials.push(m);return m;
  }
  private build(){
    this.built=true;
    // One merged shell draw, without windows, balconies or landmark asset loads.
    const positions:number[]=[],colors:number[]=[];
    // The distant silhouette uses mapped blocks >= 8 m. Small buildings remain
    // in the nearby stream; the urban silhouette has about 3,400 tall blocks.
    for(const b of WORLD.buildings)if(b.h>=8)appendBuildingShell(b,positions,colors);
    const geometry=shellGeometry(positions,colors);
    const mesh=new T.Mesh(geometry,this.material(0xaeb4a6));mesh.name='Tirana:source-footprint-distant-LOD';this.group.add(mesh);
    // Use the existing map extent and street centre lines, without making the
    // ground patch larger than the measured coverage or duplicating the city.
    const lines:T.Vector3[]=[];
    for(const r of WORLD.roads)if(!r.walk&&r.w>=5)lines.push(new T.Vector3(r.a[0],groundHeight(...r.a as [number,number])+.12,r.a[1]),new T.Vector3(r.b[0],groundHeight(...r.b as [number,number])+.12,r.b[1]));
    const roads=new T.LineSegments(new T.BufferGeometry().setFromPoints(lines),new T.LineBasicMaterial({color:0xa5aca3,fog:false,transparent:true,opacity:.5}));
    roads.name='Tirana:source-road-distant-LOD';this.group.add(roads);

  }
  update(viewer:T.Vector3,camera?:T.PerspectiveCamera){
    const visible=panoramaVisible(viewer,WORLD.bounds),blend=visible?panoramaBlend(viewer.y):0;
    if(visible&&!this.built)this.build();
    this.group.visible=visible;
    for(const m of this.materials)m.opacity=blend*.8;
    const roads=this.group.getObjectByName('Tirana:source-road-distant-LOD') as T.LineSegments|undefined;
    if(roads)(roads.material as T.LineBasicMaterial).opacity=blend*.4;

  }
  dispose(){
    this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    this.group.removeFromParent();this.group.clear();this.materials=[];
  }
}
