import {createInstitutionGuards} from './institutionGuards.mjs';
import {scheduledActorStep} from './actorSchedule.mjs';
import {createTrafficOfficers,directTraffic} from './junctionControl.mjs';
import {initPoliceDispatch,updatePolicePatrols} from './policeDispatch.mjs';
import {pedestrianIntent} from './pedestrianBehavior.mjs';
import {crowdNeighbors,separateCrowd} from './crowdBehavior.mjs';
import {shopLayout} from './shopLayout.mjs';
import {registerPedestrianDefense,pedestrianDefenseIntent} from './pedestrianDefense.mjs';
import {steerNPC,friendlyInFiringLane} from './npcNavigation.mjs';
import {createFootPatrols} from './patrols.mjs';
import {vehicleSize,citySpatialGrids} from './trafficSimulation.mjs';
import { CITY_POPULATION, initCityPopulation, nearestShop, dropWeapon, collectWeapon } from './cityPopulation.mjs';
import { WEAPON_BY_ID, STARTER_WEAPON, ensureStarterWeapons, difficultyOf } from "./weapons.mjs";
import {forceWeaponFor} from './uploadedWeapons.mjs';
import { FORCE_VEHICLE_BOUNDS } from "./albanianForces.mjs";
import { tacticalGoal, vehicleBlocks, avoidVehicles } from "./forceTactics.mjs";

// Gameplay-only, bounded systems. The server owns these values in connected runs.
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const bounded = (n, a, b) => Math.max(a, Math.min(b, n));
const armed = (n) => ["gang", "police", "soldier"].includes(n.kind);
export const wantedStars = (points) =>
  points <= 0 ? 0 : Math.min(5, Math.ceil(points / 100));
export function equipStarter(p) {
  p.health = 100;
  p.armor = 0;
  p.cash = 750;
  p.wanted = 0;
  p.lastCrime = -100;
  p.lastDamage = -100;
  p.respawnAt = 0;
  p.weapon = STARTER_WEAPON;
  const starter = WEAPON_BY_ID.get(STARTER_WEAPON);
  p.inventory = { [STARTER_WEAPON]: { ammo: starter.magazine, reserve: starter.magazine * 3 } };
  ensureStarterWeapons(p);
  p.nextShot = 0;
  p.reloadAt = 0;
  p.kills = 0;
  p.shopMessage = "";
}
export function initCityLife(state, env, mission) {
  state.lifeVersion = 2;
  state.npcs = [];
  state.units = [];
  state.effects = [];
  state.effectSeq = 0;
  state.nextDispatch = 8;
  initCityPopulation(state, env);
  state.npcs.push(...createFootPatrols(env.world,env.spawn),...createTrafficOfficers());
  state.npcs.push({
    ...state.shop,
    id: "dealer",
    kind: "dealer",
    motion: "idle",
    heading: 0,
    speed: 0,
    health: 100,
    weapon: null,
    downUntil: 0,
  });
  for(const shop of state.shops.slice(1))state.npcs.push({...shop,id:`dealer-${shop.id}`,kind:"dealer",motion:"idle",heading:0,speed:0,health:100,weapon:null,downUntil:0});
  const paths = env.world.roads
    .filter(
      (r) =>
        r.walk && dist({ x: r.a[0], z: r.a[1] }, { x: r.b[0], z: r.b[1] }) > 10,
    )
    .sort(
      (a, b) =>
        dist({ x: a.a[0], z: a.a[1] }, env.spawn) -
        dist({ x: b.a[0], z: b.a[1] }, env.spawn),
    );
  // Populate the full city; the renderer selects only nearby pedestrians.
  for (let i = 0; i < CITY_POPULATION.pedestrians && paths.length; i++) {
    const r = paths[i < 144 ? (i * 2) % paths.length : (i * 59) % paths.length];
    const t = (i * 0.173) % 1;
    const n = {
      id: `citizen-${i}`,
      kind: "civilian",
      motion: i % 7 === 0 ? "cycle" : "walk",
      x: r.a[0] + (r.b[0] - r.a[0]) * t,
      z: r.a[1] + (r.b[1] - r.a[1]) * t,
      heading: 0,
      speed: 0,
      health: 100,
      weapon: null,
      path: [
        { x: r.a[0], z: r.a[1] },
        { x: r.b[0], z: r.b[1] },
      ],
      pathIndex: 1,
      panicUntil: 0,
      downUntil: 0,
    };
    env.collide(n, 0.4);
    state.npcs.push(n);
  }
  // Distinct, deterministic neighborhood routines keep the city readable online.
  const parks = env.world.parks.filter((p) => p.length >= 3);
  for (let i = 0; i < Math.min(8, parks.length * 2); i++) {
    const park = parks[i % parks.length];
    const a = park[(i * 2) % park.length], b = park[(i * 2 + 1) % park.length];
    state.npcs.push({
      id: `park-child-${i}`,
      kind: "civilian",
      role: "child",
      motion: "play",
      x: a[0], z: a[1], heading: 0, speed: 0, health: 100, weapon: null,
      path: [{ x: a[0], z: a[1] }, { x: b[0], z: b[1] }],
      pathIndex: 1, panicUntil: 0, downUntil: 0,
    });
  }
  for (let i = 0; i < 6 && paths.length; i++) {
    const r = paths[(i * 7 + 3) % paths.length];
    state.npcs.push({
      id: `dog-walker-${i}`,
      kind: "civilian",
      role: "dog-walker",
      motion: "walk",
      x: r.a[0], z: r.a[1], heading: 0, speed: 0, health: 100, weapon: null,
      path: [{ x: r.a[0], z: r.a[1] }, { x: r.b[0], z: r.b[1] }],
      pathIndex: 1, panicUntil: 0, downUntil: 0,
    });
  }
  // Cafe regulars complement the moving crowd with small, readable social
  // groups. They use the same shared character roster as every other citizen.
  for (let i = 0; i < 10 && paths.length; i++) {
    const r = paths[(i * 13 + 5) % paths.length], t = 0.35 + (i % 3) * 0.12;
    const x = r.a[0] + (r.b[0] - r.a[0]) * t,
      z = r.a[1] + (r.b[1] - r.a[1]) * t;
    state.npcs.push({
      id: `cafe-regular-${i}`, kind: "civilian", role: "cafe-guest",
      motion: "idle", x, z, heading: Math.atan2(r.b[0] - r.a[0], r.b[1] - r.a[1]) + (i % 2 ? Math.PI : 0),
      speed: 0, health: 100, weapon: null,
      path: [{ x, z }, { x: x + 0.01, z }], pathIndex: 1,
      panicUntil: 0, downUntil: 0,
    });
  }
  // Ambulance, fire brigade and patrol vehicles share the road graph and can be
  // promoted to incident responders without a second traffic simulation.
  for (const [i, service] of ["ambulance", "fire-brigade", "police-patrol"].entries()) {
    if ([...state.cars, ...state.traffic].some(c => c.id === `service-${service}`)) continue;
    const node = env.nearestNode(env.spawn.x + 35 + i * 14, env.spawn.z - 30);
    const p = env.world.graph.nodes[node];
    const next = env.world.graph.edges.find((e) => e[0] === node)?.[1] ?? node;
    state.traffic.push({
      id: `service-${service}`,
      x: p[0], z: p[1], heading: 0, speed: 0, vx: 0, vz: 0, steering: 0,
      driver: null, model: service === "police-patrol" ? "police" : service === "ambulance" ? "taxi" : "sedan",
      service, responding: false, node, next, seed: 700 + i * 41, cruise: 7 + i,
      ...(service === "police-patrol" ? {forceVehicle: "patrol_sedan", forceCharacter: "patrol_officer"} : {}),
    });
  }
  if (mission.type === "combat") {
    const target = mission.stops[0];
    for (let i = 0; i < mission.enemies; i++) {
      const n = {
        id: `gang-${i}`,
        kind: "gang",
        motion: "walk",
        x: target.x + Math.cos(i * 1.7) * 10,
        z: target.z + Math.sin(i * 1.7) * 10,
        heading: 0,
        speed: 0,
        health: 65,
        weapon: i % 2 ? "uziSprayAttack" : "ak47VolleyAttack",
        nextShot: 3 + i,
        downUntil: 0,
        origin: { ...target },
      };
      env.collide(n, 0.45);
      state.npcs.push(n);
    }
  }
  state.npcs.push(...createInstitutionGuards(env.world,env));
  initPoliceDispatch(state,env);
  for (const p of Object.values(state.players))
    if (mission.stars) {
      p.wanted = (mission.stars - 1) * 100 + 55;
      p.lastCrime = 0;
    }
}
export function reportCrime(state, p, amount) {
  const previous = wantedStars(p.wanted);
  p.wanted = bounded(p.wanted + amount, 0, 500);
  p.lastCrime = state.elapsed;
  if (wantedStars(p.wanted) > previous) emit(state, "alert", p, p, p.id);
}
function emit(state, kind, from, to, owner, weapon = "") {
  state.effects.push({
    id: ++state.effectSeq,
    at: state.elapsed,
    kind,
    x: from.x,
    z: from.z,
    toX: to.x,
    toZ: to.z,
    owner,
    weapon,
  });
  if (state.effects.length > 48)
    state.effects.splice(0, state.effects.length - 48);
}
export function lifeAction(state, p, action) {
  if(action.startsWith("pickup:")){collectWeapon(state,p,action.slice(7));return true;}
  if (action === "reload") {
    const w = WEAPON_BY_ID.get(p.weapon),
      inv = p.inventory[p.weapon];
    if (w && inv && inv.ammo < w.magazine && inv.reserve > 0 && !p.reloadAt) {
      p.reloadAt = state.elapsed + w.reload;
      emit(state, "reload", p, p, p.id);
    }
    return true;
  }
  if (action === "holster") {
    p.weapon = p.weapon ? "" : Object.keys(p.inventory)[0];
    p.reloadAt = 0;
    return true;
  }
  if (action.startsWith("equip:")) {
    const id = action.slice(6);
    if(!id){p.weapon='';p.reloadAt=0;return true;}
    if (p.inventory[id] && WEAPON_BY_ID.has(id)) {
      p.weapon = id;
      p.reloadAt = 0;
    }
    return true;
  }
  if (!action.startsWith("buy:")) return false;
  p.shopMessage = "";
  if (p.carId || (!nearestShop(state,p) || dist(p, nearestShop(state,p)) > 9) || p.health <= 0) {
    p.shopMessage = "Walk up to Arben to shop.";
    return true;
  }
  if (wantedStars(p.wanted) > 0) {
    p.shopMessage = "Lose your wanted stars before shopping.";
    return true;
  }
  const id = action.slice(4);
  if (id === "medkit" || id === "armor") {
    const price = id === "medkit" ? 90 : 180;
    if ((id === "medkit" ? p.health : p.armor) >= 100) {
      p.shopMessage = "Already full.";
      return true;
    }
    if (p.cash < price) {
      p.shopMessage = "Not enough street cash.";
      return true;
    }
    p.cash -= price;
    if (id === "medkit") p.health = 100;
    else p.armor = 100;
    p.shopMessage = id === "medkit" ? "Health restored." : "Armor equipped.";
    emit(state, "purchase", p, p, p.id);
    return true;
  }
  const w = WEAPON_BY_ID.get(id);
  if (!w) {
    p.shopMessage = "That item is unavailable.";
    return true;
  }
  const own = p.inventory[id],
    price = own ? Math.max(30, Math.round(w.price * 0.2)) : w.price;
  if (w.category === 'melee') return true;
  if (own && own.reserve >= w.magazine * 8) {
    p.shopMessage = "Ammo is full.";
    return true;
  }
  if (p.cash < price) {
    p.shopMessage = "Not enough street cash.";
    return true;
  }
  p.cash -= price;
  if (own) own.reserve = Math.min(w.magazine * 8, own.reserve + w.magazine * 3);
  else p.inventory[id] = { ammo: w.magazine, reserve: w.magazine * 3 };
  p.weapon = id;
  p.reloadAt = 0;
  p.shopMessage = own ? "Ammo restocked." : `${w.label} equipped.`;
  emit(state, "purchase", p, p, p.id);
  return true;
}
export function harm(state, target, amount, attacker, env) {
  if (
    target.health <= 0 ||
    target.kind === "dealer" ||
    target.finished ||
    target.failed
  )
    return;
  amount = env.damageAmount ? env.damageAmount(target, amount, attacker) : amount;
  if (target.kind) {
    target.health = Math.max(0, target.health - amount);
    target.panicUntil = state.elapsed + 12;
    registerPedestrianDefense(target,attacker,amount,state.elapsed);
    if (!target.health) {
      dropWeapon(state,target);
      target.downUntil = state.elapsed + (target.kind === "gang" ? 3600 : 35);
      if (attacker?.inventory && target.kind === "gang") {
        attacker.kills++;
        attacker.cash += 75;
      }
    }
  } else {
    const absorbed = Math.min(target.armor, amount * 0.65);
    target.armor -= absorbed;
    target.health = Math.max(0, target.health - (amount - absorbed));
    target.lastDamage = state.elapsed;
    if (!target.health) {
      const c = state.cars.find((c) => c.id === target.carId);
      if (c) {
        c.driver = null;
        c.speed = 0;
        c.vx = 0;
        c.vz = 0;
      }
      target.carId = null;
      target.speed = 0;
      target.reloadAt = 0;
      target.respawnAt = state.elapsed + 4;
      if (state.missionId !== "free-roam") {
        target.failed = true;
        state.message = "Run ended. Regroup and try again.";
      }
    }
  }
  env.onDamage?.(target, attacker);
  emit(state, "hit", target, target, attacker?.id || "");
}
function fire(state, p, env) {
  const w = WEAPON_BY_ID.get(p.weapon),
    inv = p.inventory[p.weapon];
  if (
    !w ||
    !inv ||
    p.carId ||
    p.health <= 0 ||
    p.reloadAt ||
    state.elapsed < p.nextShot
  )
    return;
  if (!inv.ammo) {
    lifeAction(state, p, "reload");
    return;
  }
  if(w.category!=='melee')inv.ammo--;
  p.nextShot = state.elapsed + w.interval;
  p.heading = p.input.yaw;
  const dx = -Math.sin(p.input.yaw),
    dz = -Math.cos(p.input.yaw);
  let target = null,
    nearest = w.range;
  const candidates = [
    ...state.npcs,
    ...Object.values(state.players).filter(
      (o) => o.id !== p.id && state.mode === "rivals",
    ),
  ];
  for (const n of candidates) {
    if (n.health <= 0 || n.kind === "dealer" || n.finished || n.failed)
      continue;
    const x = n.x - p.x,
      z = n.z - p.z,
      forward = x * dx + z * dz,
      side = Math.abs(x * dz - z * dx);
    // Small, explicit touch aim assist; all hits still require server line of sight.
    if (
      forward > 0 &&
      forward < nearest &&
      side < 0.7 + Math.min(1.4, forward * 0.035) &&
      env.clear(p, n) && ![...state.cars,...(state.traffic||[]),...state.units].some(c=>vehicleBlocks(p,n,c))
    ) {
      target = n;
      nearest = forward;
    }
  }
  let end = { x: p.x + dx * nearest, z: p.z + dz * nearest };
  if (!env.clear(p, end)) {
    let low = 0,
      high = nearest;
    for (let i = 0; i < 8; i++) {
      const m = (low + high) / 2;
      if (env.clear(p, { x: p.x + dx * m, z: p.z + dz * m })) low = m;
      else high = m;
    }
    end = { x: p.x + dx * low, z: p.z + dz * low };
    target = null;
  }
  const hostile = target && armed(target);
  reportCrime(
    state,
    p,
    hostile && target.kind === "gang"
      ? 4
      : target?.kind === "civilian"
        ? 85
        : target
          ? 60
          : 12,
  );
  if(w.category!=='melee')emit(state, w.radius ? "explosion" : "shot", p, end, p.id, w.id);
  if (w.radius) {
    for (const n of candidates)
      if (dist(n, end) < w.radius && env.clear(end, n))
        harm(
          state,
          n,
          w.damage * (1 - dist(n, end) / (w.radius * 1.3)),
          p,
          env,
        );
    if (dist(p, end) < w.radius) harm(state, p, w.damage * 0.4, p, env);
  } else if (target) harm(state, target, w.damage, p, env);
  for (const n of state.npcs)
    if (n.kind === "civilian" && dist(p, n) < 55)
      n.panicUntil = state.elapsed + 10;
}
export function updateCityLife(state, dt, env, mission) {
  if(state.pickups)state.pickups=state.pickups.filter(l=>!l.expiresAt||l.expiresAt>state.elapsed);
  // Retain a short, bounded event window so polling clients receive audiovisual events.
  state.effects = state.effects.filter((e) => state.elapsed - e.at < 0.7);
  const players = Object.values(state.players),
    cfg = difficultyOf(state.difficulty);
  for (const p of players) {
    if (p.health <= 0) {
      if (state.missionId === "free-roam" && state.elapsed >= p.respawnAt) {
        Object.assign(p, env.spawn);
        p.health = 100;
        p.armor = 0;
        p.wanted = 0;
        p.lastCrime = -100;
        p.lastDamage = state.elapsed;
        p.cash = Math.max(0, p.cash - 100);
        p.input = env.emptyInput();
        p.inputAt = -10;
      }
      continue;
    }
    if (p.finished || p.failed) continue;
    if (p.reloadAt && state.elapsed >= p.reloadAt) {
      const w = WEAPON_BY_ID.get(p.weapon),
        inv = p.inventory[p.weapon];
      if (w && inv) {
        const n = Math.min(w.magazine - inv.ammo, inv.reserve);
        inv.ammo += n;
        inv.reserve -= n;
      }
      p.reloadAt = 0;
    }
    if (!p.aircraftId && state.elapsed - p.inputAt < 0.45 && p.input.fire) (env.firePlayer || fire)(state, p, env);
    if (state.elapsed - p.lastDamage > 18 && p.health < 100)
      p.health = Math.min(100, p.health + dt * 1.5);
    const visible = citySpatialGrids(state).people.near(p.x,p.z,60).some(
      (n) =>
        (n.kind === 'police' || n.kind === 'soldier') &&
        n.health > 0 &&
        dist(n, p) < 60 &&
        env.clear(n, p),
    );
    if (!visible && state.elapsed - p.lastCrime > 14)
      p.wanted = Math.max(
        0,
        p.wanted - dt * (state.difficulty === "hard" ? 5 : 8),
      );
    p.searching = p.wanted > 0 && !visible;
    p.heat = wantedStars(p.wanted) / 5;
  }
  const {vehicles:vehicleGrid,people:peopleGrid}=citySpatialGrids(state);
  updatePolicePatrols(state,dt,env,{vehicles:vehicleGrid,people:peopleGrid});
  const unitsById=new Map(),squadLeaders=new Map(),squads=new Map();
  for(const unit of state.units){unitsById.set(unit.id,unit);if(!squadLeaders.has(unit.squadId))squadLeaders.set(unit.squadId,unit);}
  for(const npc of state.npcs)if(npc.squadId&&npc.health>0){let squad=squads.get(npc.squadId);if(!squad)squads.set(npc.squadId,squad=[]);squad.push(npc);}
  for (const n of state.npcs) {
    const distant=(n.kind==='civilian'||n.patrol||n.guardPost) && !players.some(p=>(p.x-n.x)**2+(p.z-n.z)**2<180*180);
    const npcDt=scheduledActorStep(n,state.elapsed,dt,distant?.4:0);
    if(!npcDt)continue;
    if (n.health <= 0) {
      n.speed = 0;
      if (n.kind === "civilian" && state.elapsed > n.downUntil) {
        n.health = 100;
        n.weaponDropped=false;
        n.panicUntil = 0;
      }
      continue;
    }
    if(n.kind==='dealer'){n.y??=shopLayout(n).standingY;continue;}
    if (n.custody) continue;
    if(n.role==='traffic-controller'){directTraffic(n,state.elapsed);continue;}
    if (env.recovering?.(n)) { n.speed=0; n.anim='hit'; continue; }
    const walkClear=(a,b)=>{
      if(!env.clear(a,b))return false;
      const probe={x:b.x,z:b.z};env.collide(probe,.45);
      return Math.hypot(probe.x-b.x,probe.z-b.z)<.01;
    };
    const navigate=n.kind!=='civilian'||players.some(p=>(p.x-n.x)**2+(p.z-n.z)**2<140**2);
    const walkTo=(goal,speed,radius=.45)=>{
      const x=n.x,z=n.z,arrived=env.along(n,navigate?steerNPC(n,goal,walkClear,state.elapsed):goal,speed,npcDt);
      env.collide(n,radius);
      // Rendered gait follows movement after collision, including scheduled
      // distant steps. Depenetration cannot accelerate the intended stride.
      const measured=Math.hypot(n.x-x,n.z-z)/npcDt;
      n.speed=Number.isFinite(measured)?Math.min(speed,measured):0;
      return arrived;
    };
    if (n.kind === "civilian") {
      const defense=pedestrianDefenseIntent(n,state,env.clear);
      if(defense){
        n.speed=0;n.anim='fight';n.behavior='defend';
        n.heading=Math.atan2(n.x-defense.target.x,n.z-defense.target.z);
        if(defense.strike)harm(state,defense.target,6,n,env);
        continue;
      }
      const nearbyPeople=peopleGrid.near(n.x,n.z,10),neighbors=crowdNeighbors(n,nearbyPeople);
      const intent=pedestrianIntent(n,state,vehicleGrid.near(n.x,n.z,25),nearbyPeople,env.world,neighbors,players);
      n.speed=0;
      if(intent.speed>0)walkTo(intent.goal,intent.speed,.4);
      if(separateCrowd(n,neighbors,npcDt))env.collide(n,.4);
      n.anim=intent.anim;
      const car = state.cars.find(
        (c) => {const size=vehicleSize(c),dx=n.x-c.x,dz=n.z-c.z;
          return c.driver&&Math.abs(c.speed)>6&&Math.abs(dx*Math.cos(c.heading)-dz*Math.sin(c.heading))<size.width/2+.25&&Math.abs(dx*Math.sin(c.heading)+dz*Math.cos(c.heading))<size.length/2+.3;},
      );
      if (car && state.elapsed - (n.hitAt || -10) > 2) {
        n.hitAt = state.elapsed;
        const driver = state.players[car.driver];
        if (driver) {
          harm(state, n, Math.min(100,Math.abs(car.speed)*5), driver, env);
          reportCrime(state, driver, 70);
          car.speed *= 0.7;
        }
      }
      continue;
    }
    const assignedUnit=n.unit&&unitsById.get(n.unit);
    if(assignedUnit){
      if((assignedUnit.destroyed||assignedUnit.burning)&&!n.deployed){
        n.deployed=true;n.motion='walk';n.x+=Math.cos(n.heading)*(n.seat%2?2:-2);n.z-=Math.sin(n.heading)*(n.seat%2?2:-2);env.collide(n,.45);
      }
      const incident=state.players[assignedUnit.target];
      const mustRide=!n.deployed&&(!incident||dist(assignedUnit,incident)>23||Math.abs(assignedUnit.speed)>.5);
      if(assignedUnit.regroup&&n.deployed&&!assignedUnit.destroyed&&!assignedUnit.burning){
        n.speed=0;walkTo(assignedUnit,3.2);n.anim='run';
        if(dist(n,assignedUnit)<3){n.deployed=false;n.motion='drive';}
        continue;
      }
      if(mustRide){
        n.x=assignedUnit.x;n.z=assignedUnit.z;n.heading=assignedUnit.heading;n.speed=assignedUnit.speed;
        n.motion='drive';n.anim=assignedUnit.forceVehicle?.includes('bike')?'ride':'drive';continue;
      }
    }
    let actual,nearest=Infinity;
    for(const candidate of players){
      if(candidate.health<=0||candidate.failed||candidate.finished)continue;
      const distance=dist(n,candidate);
      if(distance>=nearest||!(n.kind==='gang'||candidate.wanted>0&&(assignedUnit?assignedUnit.target===candidate.id:distance<70&&env.clear(n,candidate))))continue;
      actual=candidate;nearest=distance;
    }
    if(actual&&env.officerAction?.(n,actual,npcDt,env))continue;
    const p = actual && env.track ? env.track(n, actual) : actual;
    if (!p) {
      if(n.guardPost){if(dist(n,n.guardPost)>1){walkTo(n.guardPost,1.45);n.anim='walk';}else{n.speed=0;n.anim='idle';n.heading=n.guardPost.heading;}}
      else if(n.patrol&&n.path?.length){walkTo(n.path[n.pathIndex],1.45);n.anim='walk';if(dist(n,n.path[n.pathIndex])<.6)n.pathIndex=1-n.pathIndex;}
      else {n.speed=0;n.anim='idle';}
      continue;
    }
    const unit = assignedUnit,
      d = dist(n, p);
    if(unit?.destroyed && !n.deployed){n.deployed=true;n.motion='walk';n.x+=2;n.z+=1;}
    const squadLead=unit && squadLeaders.get(unit.squadId);
    if (unit && !n.deployed && (dist(squadLead||unit, p) > 23 || Math.abs(unit.speed)>.5)) {
      n.motion = "drive";
      const seatOffset = n.seat%2 ? .38 : -.32, back=Math.floor((n.seat||0)/2)*.7;
      n.x = unit.x + Math.cos(unit.heading)*seatOffset+Math.sin(unit.heading)*back;
      n.z = unit.z - Math.sin(unit.heading)*seatOffset+Math.cos(unit.heading)*back;
      n.speed = unit.speed;
      n.anim = unit.forceVehicle?.includes("bike") ? "ride" : "drive";
      n.heading = unit.heading;
      continue;
    }
    if(n.unit && !n.deployed) {
      n.deployed=true;
      n.x += Math.cos(n.heading)*(n.seat%2?1:-1)*2;
      n.z -= Math.sin(n.heading)*(n.seat%2?1:-1)*2;
      env.collide(n,.45);
    }
    n.motion = "walk";
    // Cover is within 18 m and firing within 46 m. Broad-phase cells include
    // body extents and moving actors; avoid copying the entire city per officer.
    const cars=vehicleGrid.near(n.x,n.z,60),localPeople=peopleGrid.near(n.x,n.z,50);
    if(!n.tacticCache||state.elapsed>=(n.tacticAt||0)){
      const squad=n.squadId?squads.get(n.squadId)||[n]:localPeople.filter(o=>o.health>0&&o.kind===n.kind&&dist(n,o)<45);
      n.tacticCache=tacticalGoal(n,p,squad,cars,state.elapsed,env.clear);n.tacticAt=state.elapsed+.12;
    }
    const tactic=n.tacticCache;
    n.anim=tactic.anim; n.coverId=tactic.coverId; n.speed=0;
    if(n.anim==='run'||n.anim==='walk') {
      walkTo(avoidVehicles(n,tactic.goal,cars),n.anim==='run'?3.6:1.45);
    }
    // Personal space prevents overlapping squad members even while converging.
    separateCrowd(n,crowdNeighbors(n,localPeople),npcDt,.85);
    env.collide(n,.45);
    if(n.anim==='aim'||n.anim==='cover'){const aim=Math.atan2(n.x-p.x,n.z-p.z);n.heading+=Math.atan2(Math.sin(aim-n.heading),Math.cos(aim-n.heading))*Math.min(1,npcDt*12);}
    if(n.anim!=='aim')n.aimSince=undefined;else n.aimSince??=state.elapsed;
    // Geometry cannot authorize a shot while its timer/aim state forbids it.
    // Check those gates first instead of allocating allies and tracing every
    // render tick throughout the much longer weapon cooldown.
    const readyToShoot=d<46&&n.anim==='aim'&&!actual?.arrest&&state.elapsed-(n.aimSince||0)>.18&&state.elapsed>=n.nextShot&&(!env.track||p===actual);
    const canShoot=readyToShoot&&!cars.some(c=>vehicleBlocks(n,p,c))&&!friendlyInFiringLane(n,p,localPeople.filter(o=>o.kind===n.kind||o.kind!=='gang'&&n.kind!=='gang'));
    if (canShoot && env.clear(n, actual || p)) {
      if(env.fireNPC){env.fireNPC(n,actual||p,cfg.damage);continue;}
      n.nextShot =
        state.elapsed + (n.kind === "soldier" ? 0.85 : 1.6) / cfg.damage;
      // Grace period and readable cadence give touch players time to react.
      if (state.elapsed - p.lastDamage > 0.35)
        harm(state, p, (n.kind === "soldier" ? 8 : 5) * cfg.damage, n, env);
      emit(state, "shot", n, p, n.id, n.weapon);
    }
  }
  if (mission.type === "combat") {
    const remaining = state.npcs.filter(
      (n) => n.kind === "gang" && n.health > 0,
    ).length;
    state.objectiveRemaining = remaining;
    if (!remaining) state.message = "Area clear. Reach the extraction marker.";
  }
}
