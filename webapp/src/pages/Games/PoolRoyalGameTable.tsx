"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const TABLE_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb";

const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
const BASIS_TRANSCODER_PATH = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/";

type TablePart =
  | "cloth" | "cushion" | "topWoodRail" | "sideWoodApron" | "pocketCup" | "cornerPocketPlate"
  | "middlePocketPlate" | "verticalCornerRim" | "baseCornerBlock" | "leg" | "baseFoot" | "lowerTrim" | "railSight" | "underside";
type ChoiceKey = "a" | "b";
type Palette = Record<TablePart, ChoiceKey>;
type WorkingMaterial = THREE.MeshPhysicalMaterial;
type MaterialBuckets = Record<TablePart, WorkingMaterial[]>;

type ColorOption = { label: string; color: string; metalness: number; roughness: number; envMapIntensity: number; clearcoat?: number; clearcoatRoughness?: number; };

type PartMeta = { label: string; description: string; keepSourceTexture: boolean; };

const TABLE_PARTS: TablePart[] = ["cloth","cushion","topWoodRail","sideWoodApron","pocketCup","cornerPocketPlate","middlePocketPlate","verticalCornerRim","baseCornerBlock","leg","baseFoot","lowerTrim","railSight","underside"];
const CONTROL_PARTS: TablePart[] = ["cloth","cushion","topWoodRail","railSight","pocketCup","verticalCornerRim","baseCornerBlock","leg"];
const LINKED_TO_RAIL_SIGHT = new Set<TablePart>(["sideWoodApron", "railSight"]);
const LINKED_TO_CORNER_RIM = new Set<TablePart>(["baseFoot", "verticalCornerRim"]);

const PART_META: Record<TablePart, PartMeta> = {
  cloth:{label:"Field cloth",description:"Mapped cloth.",keepSourceTexture:false}, cushion:{label:"Cushions",description:"Mapped cushions.",keepSourceTexture:false},
  topWoodRail:{label:"Top rails",description:"Keep original GLTF textures.",keepSourceTexture:true}, sideWoodApron:{label:"Side apron",description:"Linked to rail sights.",keepSourceTexture:false},
  pocketCup:{label:"Pocket cups",description:"Pocket interiors.",keepSourceTexture:false}, cornerPocketPlate:{label:"Corner plates",description:"Internal option.",keepSourceTexture:false},
  middlePocketPlate:{label:"Side plates",description:"Internal option.",keepSourceTexture:false}, verticalCornerRim:{label:"Corner rims + rounded feet",description:"Linked to rounded feet.",keepSourceTexture:false},
  baseCornerBlock:{label:"Base corners",description:"Base corners.",keepSourceTexture:false}, leg:{label:"Legs",description:"Keep original GLTF textures.",keepSourceTexture:true},
  baseFoot:{label:"Rounded feet",description:"Linked option.",keepSourceTexture:false}, lowerTrim:{label:"Lower trim",description:"Internal option.",keepSourceTexture:false},
  railSight:{label:"Side apron + rail sights",description:"Linked option.",keepSourceTexture:false}, underside:{label:"Underside",description:"Internal option.",keepSourceTexture:false}
};

const PART_OPTIONS: Record<TablePart, Record<ChoiceKey, ColorOption>> = {
  cloth:{a:{label:"Clean green field",color:"#0a7b33",metalness:0,roughness:1,envMapIntensity:0.16},b:{label:"Clean blue field",color:"#0d4fb8",metalness:0,roughness:1,envMapIntensity:0.16}},
  cushion:{a:{label:"Green cushions",color:"#064f23",metalness:0,roughness:0.94,envMapIntensity:0.24},b:{label:"Black cushions",color:"#050505",metalness:0,roughness:0.88,envMapIntensity:0.38}},
  topWoodRail:{a:{label:"Walnut rails",color:"#5a2608",metalness:0.02,roughness:0.38,envMapIntensity:1.35},b:{label:"Black rails",color:"#070605",metalness:0.04,roughness:0.28,envMapIntensity:1.75}},
  sideWoodApron:{a:{label:"Gold side apron",color:"#d8a928",metalness:0.9,roughness:0.11,envMapIntensity:5.9},b:{label:"Black side apron",color:"#050505",metalness:0.82,roughness:0.17,envMapIntensity:3.15}},
  pocketCup:{a:{label:"Black cups",color:"#000000",metalness:0,roughness:0.98,envMapIntensity:0.12},b:{label:"Dark leather cups",color:"#1b0c04",metalness:0,roughness:0.9,envMapIntensity:0.26}},
  cornerPocketPlate:{a:{label:"Gold corners",color:"#f7c943",metalness:1,roughness:0.045,envMapIntensity:8.4},b:{label:"Black corners",color:"#050505",metalness:0.9,roughness:0.11,envMapIntensity:4.2}},
  middlePocketPlate:{a:{label:"Black side plates",color:"#050505",metalness:0.88,roughness:0.12,envMapIntensity:4},b:{label:"Gold side plates",color:"#f7c943",metalness:1,roughness:0.045,envMapIntensity:8.4}},
  verticalCornerRim:{a:{label:"Gold rims + feet",color:"#d8b23d",metalness:0.98,roughness:0.06,envMapIntensity:6.8},b:{label:"Chrome rims + feet",color:"#d7dde7",metalness:1,roughness:0.055,envMapIntensity:7.2}},
  baseCornerBlock:{a:{label:"Walnut corners",color:"#7b2d11",metalness:0.02,roughness:0.48,envMapIntensity:1.1},b:{label:"Black corners",color:"#080605",metalness:0.03,roughness:0.38,envMapIntensity:1.34}},
  leg:{a:{label:"Walnut legs",color:"#3d1706",metalness:0.02,roughness:0.52,envMapIntensity:1},b:{label:"Black legs",color:"#070504",metalness:0.04,roughness:0.4,envMapIntensity:1.22}},
  baseFoot:{a:{label:"Gold rounded feet",color:"#d8b23d",metalness:1,roughness:0.065,envMapIntensity:6.8},b:{label:"Chrome rounded feet",color:"#d7dde7",metalness:1,roughness:0.055,envMapIntensity:7.2}},
  lowerTrim:{a:{label:"Gold trim",color:"#d8b23d",metalness:0.94,roughness:0.085,envMapIntensity:5.8},b:{label:"Black trim",color:"#070707",metalness:0.82,roughness:0.15,envMapIntensity:3.2}},
  railSight:{a:{label:"Gold apron + gold sights",color:"#f5d978",metalness:1,roughness:0.065,envMapIntensity:6.7},b:{label:"Black apron + black sights",color:"#050505",metalness:0.82,roughness:0.16,envMapIntensity:3}},
  underside:{a:{label:"Dark underside",color:"#1e130b",metalness:0.01,roughness:0.72,envMapIntensity:0.58},b:{label:"Black underside",color:"#050505",metalness:0.02,roughness:0.62,envMapIntensity:0.82}},
};

const DEFAULT_PALETTE: Palette = TABLE_PARTS.reduce((a,p)=>({ ...a, [p]:"a"}), {} as Palette);
DEFAULT_PALETTE.baseCornerBlock="b";

function createMaterialBuckets(): MaterialBuckets { return TABLE_PARTS.reduce((a,p)=>({ ...a,[p]:[]}), {} as MaterialBuckets); }
function choiceForPart(part: TablePart, palette: Palette): ChoiceKey { if (LINKED_TO_RAIL_SIGHT.has(part)) return palette.railSight; if (LINKED_TO_CORNER_RIM.has(part)) return palette.verticalCornerRim; return palette[part]; }
function applyCustomMaterial(material: WorkingMaterial, part: TablePart, option: ColorOption) {
  material.color.set(option.color); material.metalness=option.metalness; material.roughness=option.roughness; material.envMapIntensity=option.envMapIntensity;
  if (!PART_META[part].keepSourceTexture) { material.map=null; material.normalMap=null; material.roughnessMap=null; material.metalnessMap=null; material.bumpMap=null; material.aoMap=null; }
  material.needsUpdate=true;
}

export default function PoolRoyalGameTable() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bucketsRef = useRef<MaterialBuckets>(createMaterialBuckets());
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(()=>{
    TABLE_PARTS.forEach((part)=>bucketsRef.current[part].forEach((m)=>applyCustomMaterial(m,part,PART_OPTIONS[part][choiceForPart(part,palette)])));
  },[palette]);

  const optionRows = useMemo(()=>CONTROL_PARTS.map((part)=>({part,label:PART_META[part].label,options:PART_OPTIONS[part],selected:choiceForPart(part,palette)})),[palette]);

  useEffect(()=>{
    const host = hostRef.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#050505");
    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 120); camera.position.set(6.2, 4.2, 7.0);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 1.05, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.08)); const key = new THREE.DirectionalLight(0xffffff, 3.25); key.position.set(6,10,7); scene.add(key);

    const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_DECODER_PATH);
    const ktx2 = new KTX2Loader(); ktx2.setTranscoderPath(BASIS_TRANSCODER_PATH); ktx2.detectSupport(renderer);
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco); loader.setKTX2Loader(ktx2); loader.setMeshoptDecoder(MeshoptDecoder);

    let frame = 0;
    loader.load(TABLE_MODEL_URL,(gltf)=>{
      const table = gltf.scene; table.rotation.y = Math.PI; table.scale.setScalar(1.45);
      table.traverse((child:any)=>{
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material)?child.material:[child.material];
        child.material = mats.map((raw:THREE.Material)=>{
          const src = raw as any;
          const m = new THREE.MeshPhysicalMaterial({ name: raw.name || "source", color: src.color?.clone?.() || new THREE.Color("#ffffff"), map: src.map ?? null, normalMap: src.normalMap ?? null, roughnessMap: src.roughnessMap ?? null, metalnessMap: src.metalnessMap ?? null, roughness: src.roughness ?? 0.5, metalness: src.metalness ?? 0 });
          const name = `${child.name||""} ${raw.name||""}`.toLowerCase();
          const part: TablePart = /cloth|felt|bed|surface/.test(name) ? "cloth" : /cushion|rubber|bumper/.test(name) ? "cushion" : /leg/.test(name) ? "leg" : /rail|wood/.test(name) ? "topWoodRail" : /sight|diamond|marker|apron/.test(name) ? "railSight" : /rim|feet|foot/.test(name) ? "verticalCornerRim" : /pocket|cup/.test(name) ? "pocketCup" : "baseCornerBlock";
          applyCustomMaterial(m, part, PART_OPTIONS[part][choiceForPart(part,palette)]);
          bucketsRef.current[part].push(m);
          return m;
        });
      });
      scene.add(table);
      const roundedMat = new THREE.MeshPhysicalMaterial({ color: "#d8b23d", metalness: 1, roughness: 0.065 });
      bucketsRef.current.baseFoot.push(roundedMat);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x,z],i)=>{ const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.18,0.055,48), roundedMat); foot.position.set(x*1.8,0.03,z*0.9); foot.name=`rounded_foot_${i}`; scene.add(foot); });
    });

    const animate = ()=>{ frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }; animate();
    return ()=>{ cancelAnimationFrame(frame); controls.dispose(); pmrem.dispose(); ktx2.dispose(); draco.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  },[]);

  return <div ref={hostRef} style={{position:"fixed",inset:0,background:"#050505"}}><div style={{position:"fixed",left:10,right:10,bottom:10,background:"rgba(0,0,0,0.72)",borderRadius:18,padding:11,color:"white"}}>{optionRows.map((row)=><div key={row.part} style={{display:"grid",gridTemplateColumns:"minmax(116px, 172px) 1fr",gap:8,alignItems:"center",marginBottom:8}}><div style={{fontSize:11.3,fontWeight:900}}>{row.label}</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{(["a","b"] as ChoiceKey[]).map((choice)=><button key={choice} onClick={()=>setPalette((c)=>({...c,[row.part]:choice}))} style={{border:"1px solid rgba(255,255,255,0.18)",background:row.selected===choice?"rgba(255,255,255,0.16)":"rgba(255,255,255,0.06)",color:"white",borderRadius:999,padding:"6px 8px"}}>{row.options[choice].label}</button>)}</div></div>)}</div></div>;
}
