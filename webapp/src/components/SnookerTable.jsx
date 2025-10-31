import React, { useMemo } from "react";
import * as THREE from "three";

const TABLE_SCALE = 1.17;
const TABLE_THICKNESS = 1.8 * TABLE_SCALE; // matches PoolTable frame stackup
const POOL_PLAYFIELD_LENGTH = 151.03296;
const POOL_PLAYFIELD_WIDTH = 75.51648;
const SNOOKER_PLAYFIELD_LENGTH = POOL_PLAYFIELD_LENGTH * 2; // ~302.06592
const SNOOKER_PLAYFIELD_WIDTH = POOL_PLAYFIELD_LENGTH; // ~151.03296
const SIDE_RAIL_THICKNESS = 0.85176;
const END_RAIL_THICKNESS = 1.70352;
const RAIL_HEIGHT = TABLE_THICKNESS * 1.78;
const CLOTH_LIFT = 0.02;
const MARKING_LIFT = 0.012;
const POCKET_DEPTH = TABLE_THICKNESS * 1.4;
const POOL_CORNER_RADIUS = 3.3982416;
const POOL_SIDE_RADIUS = 3.449215224;
const CORNER_POCKET_RADIUS = POOL_CORNER_RADIUS * 0.8;
const SIDE_POCKET_RADIUS = POOL_SIDE_RADIUS * 0.75;
const POCKET_SEGMENTS = 32;
const LINE_THICKNESS_MM = 12; // visual weight for baulk line + D arc
const SPOT_RADIUS_MM = 8;
const BAULK_DISTANCE_MM = 737;
const D_RADIUS_MM = 292;
const PINK_FROM_TOP_MM = 737;
const BLACK_FROM_TOP_MM = 324;
const TABLE_LENGTH_MM = 3569;

export default function SnookerTable({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  const {
    clothGeometry,
    baulkLineGeometry,
    dArcGeometry,
    spotGeometry,
    railLongGeometry,
    railShortGeometry,
    collisionLongGeometry,
    collisionShortGeometry,
    cornerPocketGeometry,
    sidePocketGeometry,
    lineMaterial,
    dMaterial,
    spotMaterials,
    clothMaterial,
    railMaterial,
    pocketMaterial,
    collisionMaterial,
    baulkLineZ,
    brownSpotZ,
    blueSpotZ,
    pinkSpotZ,
    blackSpotZ,
    halfWidth,
    halfLength
  } = useMemo(() => {
    const clothGeom = new THREE.PlaneGeometry(
      SNOOKER_PLAYFIELD_WIDTH,
      SNOOKER_PLAYFIELD_LENGTH
    );
    clothGeom.rotateX(-Math.PI / 2);

    const mmToUnits = SNOOKER_PLAYFIELD_LENGTH / TABLE_LENGTH_MM;
    const lineThickness = Math.max(MARKING_LIFT, mmToUnits * LINE_THICKNESS_MM);
    const spotRadius = Math.max(MARKING_LIFT, mmToUnits * SPOT_RADIUS_MM);

    const baulkGeom = new THREE.PlaneGeometry(
      SNOOKER_PLAYFIELD_WIDTH - SIDE_RAIL_THICKNESS * 0.6,
      lineThickness
    );
    baulkGeom.rotateX(-Math.PI / 2);

    const dRadiusUnits = Math.max(lineThickness * 1.5, mmToUnits * D_RADIUS_MM);
    const dArcGeom = new THREE.RingGeometry(
      Math.max(MARKING_LIFT, dRadiusUnits - lineThickness * 0.5),
      dRadiusUnits + lineThickness * 0.5,
      64,
      1,
      Math.PI,
      Math.PI
    );
    dArcGeom.rotateX(-Math.PI / 2);
    dArcGeom.rotateZ(Math.PI / 2);

    const spotGeom = new THREE.CircleGeometry(spotRadius, 32);
    spotGeom.rotateX(-Math.PI / 2);

    const railLongGeom = new THREE.BoxGeometry(
      SIDE_RAIL_THICKNESS,
      RAIL_HEIGHT,
      SNOOKER_PLAYFIELD_LENGTH + END_RAIL_THICKNESS * 2
    );
    const railShortGeom = new THREE.BoxGeometry(
      SNOOKER_PLAYFIELD_WIDTH + SIDE_RAIL_THICKNESS * 2,
      RAIL_HEIGHT,
      END_RAIL_THICKNESS
    );

    const collisionLongGeom = new THREE.BoxGeometry(
      SIDE_RAIL_THICKNESS,
      RAIL_HEIGHT,
      SNOOKER_PLAYFIELD_LENGTH + END_RAIL_THICKNESS * 2
    );
    const collisionShortGeom = new THREE.BoxGeometry(
      SNOOKER_PLAYFIELD_WIDTH + SIDE_RAIL_THICKNESS * 2,
      RAIL_HEIGHT,
      END_RAIL_THICKNESS
    );

    const cornerPocketGeom = new THREE.CylinderGeometry(
      CORNER_POCKET_RADIUS,
      CORNER_POCKET_RADIUS * 0.82,
      POCKET_DEPTH,
      POCKET_SEGMENTS,
      1,
      false
    );
    const sidePocketGeom = new THREE.CylinderGeometry(
      SIDE_POCKET_RADIUS,
      SIDE_POCKET_RADIUS * 0.82,
      POCKET_DEPTH,
      POCKET_SEGMENTS,
      1,
      false
    );

    const clothMat = new THREE.MeshPhysicalMaterial({
      name: "SnookerClothMaterial",
      color: 0x0b7a3c,
      metalness: 0.08,
      roughness: 0.48,
      clearcoat: 0.12,
      clearcoatRoughness: 0.65
    });
    clothMat.side = THREE.DoubleSide;

    const railMat = new THREE.MeshStandardMaterial({
      name: "SnookerRailMaterial",
      color: 0x5a3a26,
      metalness: 0.22,
      roughness: 0.52
    });

    const pocketMat = new THREE.MeshStandardMaterial({
      name: "SnookerPocketMaterial",
      color: 0x111111,
      metalness: 0.12,
      roughness: 0.76
    });

    const baseLineMat = new THREE.MeshBasicMaterial({
      name: "SnookerLineMaterial",
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide
    });

    const dMat = baseLineMat.clone();

    const makeSpotMaterial = (hex) => {
      const mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide
      });
      return mat;
    };

    const spotMats = {
      brown: makeSpotMaterial(0x7a4b2a),
      blue: makeSpotMaterial(0x1c7ad6),
      pink: makeSpotMaterial(0xff82c5),
      black: makeSpotMaterial(0x111111)
    };

    const collisionMat = new THREE.MeshBasicMaterial({ visible: false });

    const baulkZ = -SNOOKER_PLAYFIELD_LENGTH / 2 + BAULK_DISTANCE_MM * mmToUnits;
    const blueZ = 0;
    const pinkZ = SNOOKER_PLAYFIELD_LENGTH / 2 - PINK_FROM_TOP_MM * mmToUnits;
    const blackZ = SNOOKER_PLAYFIELD_LENGTH / 2 - BLACK_FROM_TOP_MM * mmToUnits;

    return {
      clothGeometry: clothGeom,
      baulkLineGeometry: baulkGeom,
      dArcGeometry: dArcGeom,
      spotGeometry: spotGeom,
      railLongGeometry: railLongGeom,
      railShortGeometry: railShortGeom,
      collisionLongGeometry: collisionLongGeom,
      collisionShortGeometry: collisionShortGeom,
      cornerPocketGeometry: cornerPocketGeom,
      sidePocketGeometry: sidePocketGeom,
      lineMaterial: baseLineMat,
      dMaterial: dMat,
      spotMaterials: spotMats,
      clothMaterial: clothMat,
      railMaterial: railMat,
      pocketMaterial: pocketMat,
      collisionMaterial: collisionMat,
      baulkLineZ: baulkZ,
      brownSpotZ: baulkZ,
      blueSpotZ: blueZ,
      pinkSpotZ: pinkZ,
      blackSpotZ: blackZ,
      halfWidth: SNOOKER_PLAYFIELD_WIDTH / 2,
      halfLength: SNOOKER_PLAYFIELD_LENGTH / 2
    };
  }, []);

  const pockets = useMemo(() => {
    const halfWidth = SNOOKER_PLAYFIELD_WIDTH / 2;
    const halfLength = SNOOKER_PLAYFIELD_LENGTH / 2;

    return [
      { key: "corner-bl", position: [-halfWidth, -POCKET_DEPTH / 2, -halfLength], type: "corner" },
      { key: "corner-br", position: [halfWidth, -POCKET_DEPTH / 2, -halfLength], type: "corner" },
      { key: "corner-tr", position: [halfWidth, -POCKET_DEPTH / 2, halfLength], type: "corner" },
      { key: "corner-tl", position: [-halfWidth, -POCKET_DEPTH / 2, halfLength], type: "corner" },
      { key: "side-left", position: [-halfWidth, -POCKET_DEPTH / 2, 0], type: "side" },
      { key: "side-right", position: [halfWidth, -POCKET_DEPTH / 2, 0], type: "side" }
    ];
  }, []);

  const collisionBodies = useMemo(() => {
    const halfWidth = SNOOKER_PLAYFIELD_WIDTH / 2;
    const halfLength = SNOOKER_PLAYFIELD_LENGTH / 2;
    const railY = RAIL_HEIGHT / 2;

    return [
      {
        key: "collision-long-left",
        geometry: collisionLongGeometry,
        position: [-(halfWidth + SIDE_RAIL_THICKNESS / 2), railY, 0],
        rotation: [0, 0, 0],
        userData: {
          surface: "cushion",
          axis: "x",
          name: "leftLongRail"
        }
      },
      {
        key: "collision-long-right",
        geometry: collisionLongGeometry,
        position: [halfWidth + SIDE_RAIL_THICKNESS / 2, railY, 0],
        rotation: [0, 0, 0],
        userData: {
          surface: "cushion",
          axis: "x",
          name: "rightLongRail"
        }
      },
      {
        key: "collision-short-bottom",
        geometry: collisionShortGeometry,
        position: [0, railY, -(halfLength + END_RAIL_THICKNESS / 2)],
        rotation: [0, 0, 0],
        userData: {
          surface: "cushion",
          axis: "z",
          name: "baulkRail"
        }
      },
      {
        key: "collision-short-top",
        geometry: collisionShortGeometry,
        position: [0, railY, halfLength + END_RAIL_THICKNESS / 2],
        rotation: [0, 0, 0],
        userData: {
          surface: "cushion",
          axis: "z",
          name: "topRail"
        }
      }
    ];
  }, [collisionLongGeometry, collisionShortGeometry]);

  return (
    <group name="SnookerTable" position={position} rotation={rotation} scale={scale}>
      <group name="SnookerCloth">
        <mesh
          name="SnookerClothSurface"
          geometry={clothGeometry}
          material={clothMaterial}
          position={[0, CLOTH_LIFT, 0]}
          receiveShadow
        />
        <mesh
          name="SnookerBaulkLine"
          geometry={baulkLineGeometry}
          material={lineMaterial}
          position={[0, CLOTH_LIFT + MARKING_LIFT, baulkLineZ]}
          renderOrder={10}
        />
        <mesh
          name="SnookerDArc"
          geometry={dArcGeometry}
          material={dMaterial}
          position={[0, CLOTH_LIFT + MARKING_LIFT, baulkLineZ]}
          renderOrder={10}
        />
        <mesh
          name="SnookerSpotBrown"
          geometry={spotGeometry}
          material={spotMaterials.brown}
          position={[0, CLOTH_LIFT + MARKING_LIFT, brownSpotZ]}
          renderOrder={10}
        />
        <mesh
          name="SnookerSpotBlue"
          geometry={spotGeometry}
          material={spotMaterials.blue}
          position={[0, CLOTH_LIFT + MARKING_LIFT, blueSpotZ]}
          renderOrder={10}
        />
        <mesh
          name="SnookerSpotPink"
          geometry={spotGeometry}
          material={spotMaterials.pink}
          position={[0, CLOTH_LIFT + MARKING_LIFT, pinkSpotZ]}
          renderOrder={10}
        />
        <mesh
          name="SnookerSpotBlack"
          geometry={spotGeometry}
          material={spotMaterials.black}
          position={[0, CLOTH_LIFT + MARKING_LIFT, blackSpotZ]}
          renderOrder={10}
        />
      </group>
      <group name="SnookerRails">
        <mesh
          name="SnookerRailLeft"
          geometry={railLongGeometry}
          material={railMaterial}
          position={[-(halfWidth + SIDE_RAIL_THICKNESS / 2), RAIL_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          name="SnookerRailRight"
          geometry={railLongGeometry}
          material={railMaterial}
          position={[halfWidth + SIDE_RAIL_THICKNESS / 2, RAIL_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
        />
        <mesh
          name="SnookerRailBaulk"
          geometry={railShortGeometry}
          material={railMaterial}
          position={[0, RAIL_HEIGHT / 2, -(halfLength + END_RAIL_THICKNESS / 2)]}
          castShadow
          receiveShadow
        />
        <mesh
          name="SnookerRailTop"
          geometry={railShortGeometry}
          material={railMaterial}
          position={[0, RAIL_HEIGHT / 2, halfLength + END_RAIL_THICKNESS / 2]}
          castShadow
          receiveShadow
        />
      </group>
      <group name="SnookerPockets">
        {pockets.map((pocket) => (
          <mesh
            key={pocket.key}
            name={`SnookerPocket-${pocket.key}`}
            geometry={
              pocket.type === "corner" ? cornerPocketGeometry : sidePocketGeometry
            }
            material={pocketMaterial}
            position={pocket.position}
            castShadow={false}
            receiveShadow
          />
        ))}
      </group>
      <group name="SnookerCollision">
        {collisionBodies.map((body) => (
          <mesh
            key={body.key}
            geometry={body.geometry}
            material={collisionMaterial}
            position={body.position}
            rotation={body.rotation}
            userData={body.userData}
          />
        ))}
        {pockets.map((pocket) => (
          <mesh
            key={`${pocket.key}-collision`}
            geometry={
              pocket.type === "corner" ? cornerPocketGeometry : sidePocketGeometry
            }
            material={collisionMaterial}
            position={pocket.position}
            userData={{
              surface: "pocket",
              name: pocket.key
            }}
          />
        ))}
      </group>
    </group>
  );
}
