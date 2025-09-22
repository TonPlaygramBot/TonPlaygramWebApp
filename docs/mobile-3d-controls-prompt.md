📱 Mobile-First 3D Controls — SI I SHOH NË MOBILE (Portrait, Touch-Only)

Platforma & Ekrani

Target: mobile/tablet, portrait, full-screen.

FPS min: 60 në pajisje mesatare (fallback i qetë në 30).

UI e madhe për gisht.


Konventa e Boshtit (Three.js)

World up = +Y.

“Përpara” vizualisht = drejt asaj ku po shikon kamera (-Z në hapësirë).

Graviteti: Y = -9.81 (poshtë është negativ).


Kamera (FPS/Orbit)

Euler order: camera.rotation.order = 'YXZ'.

yaw = rrotullim rreth Y; pitch = rrotullim rreth X (me clamp në ±(π/2 − ε)).


NDC për Tap/Pointer (obligative)

X: djathtas → rrit vlerën.

Y: poshtë → ul vlerën (pra vendos ‘-’ te Y).


// pointer -> NDC (për raycaster)
// e.clientX/e.clientY ose touch.clientX/Y
const x = ((px - rect.left)  / rect.width)  * 2 - 1;
const y = -((py - rect.top)  / rect.height) * 2 + 1; // VËRE ‘-’
raycaster.setFromCamera({ x, y }, camera);

Gjestet SI I NDJEJ NË EKRAN

Swipe/Drag horizontal (ekran) → Shiko majtas/djathtas
Drag djathtas ⇒ kamera shikon djathtas.

Swipe/Drag vertical (ekran) → Shiko lart/poshtë
Drag lart ⇒ kamera shikon lart.

Swipe për lëvizje (nëse zgjidhet)
Drag lart ⇒ ec përpara; Drag poshtë ⇒ ec mbrapa.
Drag djathtas ⇒ strafe djathtas; Drag majtas ⇒ strafe majtas.

Pinch
Pinch out (hap gishtat) ⇒ zoom in (afrohu).
Pinch in (mbyll gishtat) ⇒ zoom out (largohu).


Mapimi i Drag-ut në Kamerë (shenjat fikse)

// dx, dy: delta piksel në ekran (djathtas/poshtë janë pozitive)
yaw   -= dx * rotSpeed;   // Drag djathtas -> shiko djathtas
pitch -= dy * rotSpeed;   // Drag lart    -> shiko lart
// Clamp pitch
pitch = THREE.MathUtils.clamp(pitch, -Math.PI/2 + 0.001, Math.PI/2 - 0.001);
camera.rotation.set(pitch, yaw, 0, 'YXZ');

Lëvizje “përpara” sipas drejtimit të kamerës (shenjat fikse)

// “Përpara” = aty ku shoh kamera (dir nga camera.getWorldDirection)
const dir = new THREE.Vector3();
camera.getWorldDirection(dir); // kthen drejtimin vizual (-Z në world), e përdorim AS-IS

// forward/back & strafe me shenja SI NDJEHET NË EKRAN
player.position.addScaledVector(dir, +forward * speed * dt); // lart = +forward
player.translateX(+strafe * speed * dt); // djathtas = +strafe

Mapper i vetëm për gestet → veprime (shenja standarde)

// Input drag (ekran) -> look & move
function mapDragToLook(dx, dy) {
  return {
    yawDelta:   -dx, // djathtas -> shiko djathtas
    pitchDelta: -dy  // lart     -> shiko lart
  };
}
function mapDragToMove(dx, dy) {
  return {
    forward: -dy,  // lart -> ec përpara
    strafe:  +dx   // djathtas -> strafe djathtas
  };
}

Pinch Zoom (Distance delta > 0 ⇒ zoom in)

function pinchToZoomDelta(prevDist, currDist) {
  return (currDist - prevDist); // pozitive => zoom in
}

OrbitControls (nëse përdoren)

controls.rotateSpeed = -1.0;           // Drag djathtas -> orbit djathtas (vizual natyral)
controls.panSpeed    = +1.0;           // Pan natyral në screen space
controls.screenSpacePanning = true;

Rregulla Antiinversim

Mos përdor scale negative në mesh/parent (shkakton pasqyra & normalë të përmbysur).

Nëse diçka del “mbrapsht”, ndërro vetëm shenjën në mapper-in përkatës, JO kudo.


Gravitet & Fizikë

// Cannon.js
world.gravity.set(0, -9.81, 0);
// Rapier
world.gravity = { x: 0, y: -9.81, z: 0 };

Kualitet & Stabilitet

requestAnimationFrame, fixed dt ku mundet.

Shmang post-processing të rëndë; materiale standarde/fizike të lehta.

Raycaster vetëm on-demand (tap), jo çdo frame.


Kontrata e Sjelljes (QA)

1. Drag djathtas → shiko djathtas ✅


2. Drag lart → shiko lart ✅


3. Drag lart (modalitet lëvizjeje) → ec përpara ✅


4. Pinch out → zoom in ✅


5. Tap target → y ka minus në NDC ✅


6. Graviteti -Y → bie poshtë ✅




---

> Ky prompt është standardi ynë. Çdo dev e implementon fiks këtë hartë shenjash. Nëse diçka duket e përmbysur, lejohet vetëm ndryshimi i shenjës në ato 3 funksione: mapDragToLook, mapDragToMove, pinchToZoomDelta—asgjë tjetër.


