import {URBAN_DATUM_BOUNDS} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WORLD} from './shared/world.mjs';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {InfrastructureLayer} from '../tirana-environment/InfrastructureLayer';
import {UrbanLighting} from '../tirana-environment/UrbanLighting';
import {CHANNEL_LINER_RUN, riverFlowOrigins} from '../tirana-environment/riverShapeCore.mjs';
import {createRiverWater, flowSurface, styleRiverLiner} from '../tirana-environment/RiverSurface';
import {MappedLakes} from "../tirana-environment/MappedLakes";
import {PavementAprons} from '../tirana-environment/PavementAprons';
import {WATER_PATHS, WATER_LEVEL, BED_LEVEL, BANK_LEVEL, BANK_WIDTH, cutChannels, surfaceGeometry, bankGeometry, riverRing} from '../tirana-environment/riverGeometry';

/** A continuous ground datum with actual openings, shared by all city views.
 * Source waterways control plan position; depth is explicit art direction. */
export class LandscapeVisuals {
  readonly group = new T.Group();
  readonly materials: EnvironmentMaterials;
  readonly infrastructure: InfrastructureLayer;
  readonly lighting: UrbanLighting;
  readonly aprons: PavementAprons;
  readonly lakes: MappedLakes;
  private dead = false;
  private time = {value:0};
  private water: T.MeshPhysicalMaterial;
  constructor(loadTextures = true, blocked?: (x:number,z:number,pad:number)=>boolean) {
    this.group.name = 'Tirana:recessed-Lana-and-continuous-terrain';
    this.group.userData.waterLevel = WATER_LEVEL;
    this.materials = new EnvironmentMaterials(loadTextures);
    const grass=this.materials.create('grass_path_2',0xb2bc9e,true);
    const concrete=this.materials.create('rough_concrete',0x9c9f95);
    const bed=this.materials.create('asphalt_02',0x67665a);
    const [x0,z0,x1,z1]=URBAN_DATUM_BOUNDS;
    this.addMerged(cutChannels([[x0-80,z0-80],[x1+80,z0-80],[x1+80,z1+80],[x0-80,z1+80]])
      .map(p=>surfaceGeometry(p,-.045)),grass,'Terrain with open watercourses');
    const paving=this.materials.create('concrete_pavement',0xd7d2c6);
    this.aprons=new PavementAprons(WORLD,paving);this.group.add(this.aprons.group);
    this.water=createRiverWater(this.time);
    styleRiverLiner(concrete);
    const flowOrigins=riverFlowOrigins(WATER_PATHS);
    const surfaces:T.BufferGeometry[]=[],beds:T.BufferGeometry[]=[],slopes:T.BufferGeometry[]=[],banks:T.BufferGeometry[]=[];
    for(const path of WATER_PATHS){
      const level=path.lana?WATER_LEVEL:-1.15, bottom=path.lana?BED_LEVEL:-1.55;
      const shoulder=path.lana?-1.6:-.65;
      surfaces.push(flowSurface(path,level,bottom,shoulder,flowOrigins.get(path.id)??0));
      beds.push(surfaceGeometry([riverRing(path,.2)],bottom));
      for(const side of [-1,1]){
        slopes.push(bankGeometry(path,side*path.width/2,bottom,side*(path.width/2+CHANNEL_LINER_RUN),shoulder,level));
        banks.push(bankGeometry(path,side*(path.width/2+CHANNEL_LINER_RUN),shoulder,side*(path.width/2+BANK_WIDTH),BANK_LEVEL));
      }
    }
    this.addMerged(beds,bed,'River bed');
    this.addMerged(slopes,concrete,'Concrete channel slopes');
    this.addMerged(banks,grass,'Planted river embankments');
    this.addMerged(surfaces,this.water,'Recessed water');
    this.lakes=new MappedLakes(WORLD.waterAreas);this.group.add(this.lakes.group);
    this.infrastructure=new InfrastructureLayer(loadTextures,blocked);
    this.lighting=new UrbanLighting(blocked);
    this.group.add(this.infrastructure.group,this.lighting.group);
  }
  private addMerged(parts:T.BufferGeometry[],material:T.Material,name:string){
    if(!parts.length)return;
    // ShapeGeometry is indexed; banks are triangles. Each batch has one layout.
    const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
    if(!geometry)throw Error(`Cannot build ${name}`);
    const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;this.group.add(mesh);
  }
  update(viewer:{x:number;z:number},seconds:number,battery:boolean){
    if(this.dead)return;this.time.value=seconds;this.lakes.update(viewer,seconds,battery);this.infrastructure.update(viewer,seconds,battery);this.lighting.update(viewer,seconds,battery);this.aprons.update(viewer,seconds,battery);
  }
  dispose(){
    if(this.dead)return;this.dead=true;
    this.lakes.dispose();
    this.infrastructure.dispose();
    this.lighting.dispose();this.aprons.dispose();
    this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
    this.materials.dispose();this.water.dispose();this.group.clear();this.group.removeFromParent();
  }
}
