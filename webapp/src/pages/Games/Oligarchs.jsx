import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Building2, Coins, Crosshair, Dice5, Flame, RotateCcw, Shield, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { CAPTURE_ANIMATION_OPTIONS, TOKEN_PIECE_OPTIONS } from '../../config/ludoBattleOptions.js';
import './oligarchs.css';

const COLORS = ['#34d399', '#ef4444', '#60a5fa', '#fbbf24'];
const NAMES = ['You', 'The Syndicate', 'Iron Bloc', 'Nova Circle'];
const GROUP_COLORS = { Energy: '#f59e0b', Strategy: '#ef4444', Tourism: '#22c55e', Media: '#a855f7', Technology: '#06b6d4' };
const TILES = [
  ['World Summit', 'start'], ['North Sea Oil', 'asset', 'Energy', 120, 24], ['Back Channel', 'card'], ['Suez Passage', 'asset', 'Strategy', 150, 30],
  ['Sanctions', 'tax'], ['Riviera Resorts', 'asset', 'Tourism', 130, 26], ['Intel Drop', 'card'], ['Global News Network', 'asset', 'Media', 170, 34],
  ['Safe House', 'rest'], ['Baltic Base', 'asset', 'Strategy', 190, 38], ['Crypto Exchange', 'asset', 'Technology', 200, 40], ['Power Play', 'card'],
  ['Market Crash', 'tax'], ['Pacific Ports', 'asset', 'Strategy', 220, 44], ['Desert Oil Fields', 'asset', 'Energy', 240, 48], ['Media Scandal', 'card'],
  ['The Tribunal', 'tribunal'], ['Orbital Systems', 'asset', 'Technology', 270, 54], ['Island Resorts', 'asset', 'Tourism', 230, 46], ['Arms Deal', 'card'],
  ['Influence Tax', 'tax'], ['World Stream', 'asset', 'Media', 290, 58], ['Rare Earth Mines', 'asset', 'Energy', 310, 62], ['Coup Attempt', 'card'],
  ['Black Site', 'rest'], ['Defense Network', 'asset', 'Strategy', 340, 68], ['AI Consortium', 'asset', 'Technology', 360, 72], ['Empire Tower', 'asset', 'Media', 400, 80]
].map(([name, type, group, price = 0, rent = 0], id) => ({ id, name, type, group, price, rent }));

export const createOligarchPlayers = () => NAMES.map((name, id) => ({ id, name, cash: 1000, position: 0, assets: [], heat: 0, influence: 0, jailed: 0, color: COLORS[id] }));
const edgePosition = (index, radius = 3.35) => {
  const side = Math.floor(index / 7), step = (index % 7) / 7;
  if (side === 0) return [-radius + step * radius * 2, 0, radius];
  if (side === 1) return [radius, 0, radius - step * radius * 2];
  if (side === 2) return [radius - step * radius * 2, 0, -radius];
  return [-radius, 0, -radius + step * radius * 2];
};

function Token({ player, active }) {
  const ref = useRef();
  const target = useMemo(() => edgePosition(player.position, 2.92), [player.position]);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(target[0] + (player.id % 2) * .16, .32, target[2] + Math.floor(player.id / 2) * .16), Math.min(1, delta * 7));
    ref.current.position.y = .32 + (active ? Math.abs(Math.sin(clock.elapsedTime * 5)) * .13 : 0);
    ref.current.rotation.y += delta * (active ? 3 : .5);
  });
  return <group ref={ref}><mesh castShadow><cylinderGeometry args={[.16, .21, .3, 20]} /><meshStandardMaterial color={player.color} metalness={.65} roughness={.24} /></mesh><mesh position={[0,.21,0]}><sphereGeometry args={[.105,16,12]}/><meshStandardMaterial color="#f8fafc" emissive={player.color} emissiveIntensity={.15}/></mesh></group>;
}

function Board({ players, owners, turn, attack }) {
  const weapon = useRef();
  useFrame(({ clock }) => { if (weapon.current) weapon.current.rotation.z = attack ? Math.sin(clock.elapsedTime * 18) * .16 : 0; });
  return <>
    <ambientLight intensity={1.5}/><directionalLight castShadow position={[3,8,4]} intensity={2.2}/>
    <group rotation={[-0.02,0,0]}>
      <RoundedBox args={[8.4,.38,8.4]} radius={.28} position={[0,-.35,0]} castShadow><meshStandardMaterial color="#2a160c" roughness={.27} metalness={.25}/></RoundedBox>
      <RoundedBox args={[7.55,.18,7.55]} radius={.18} position={[0,-.08,0]} receiveShadow><meshStandardMaterial color="#071e1b" roughness={.5}/></RoundedBox>
      {TILES.map((tile) => { const [x,,z] = edgePosition(tile.id); const owner = owners[tile.id]; return <group key={tile.id} position={[x,.08,z]} rotation={[0, tile.id >= 7 && tile.id < 21 ? Math.PI/2 : 0,0]}>
        <RoundedBox args={[.82,.12,.78]} radius={.06}><meshStandardMaterial color={owner !== undefined ? COLORS[owner] : GROUP_COLORS[tile.group] || (tile.type === 'card' ? '#7c3aed' : '#243340')} roughness={.42}/></RoundedBox>
        <Text position={[0,.08,0]} rotation={[-Math.PI/2,0,0]} fontSize={.095} maxWidth={.68} textAlign="center" color="white">{tile.name}</Text>
      </group>; })}
      <Text position={[0,.05,-.15]} rotation={[-Math.PI/2,0,0]} fontSize={.68} color="#e8bd55" anchorX="center">OLIGARCHS</Text>
      <Text position={[0,.04,.55]} rotation={[-Math.PI/2,0,0]} fontSize={.2} color="#94a3b8">CONTROL THE WORLD</Text>
      {players.map((p) => <Token key={p.id} player={p} active={p.id === turn}/>) }
      <group ref={weapon} position={[0,.38,1.45]} rotation={[0,0,-.25]}><mesh><boxGeometry args={[1,.09,.12]}/><meshStandardMaterial color="#343b43" metalness={.9}/></mesh><mesh position={[.42,-.1,0]}><boxGeometry args={[.2,.22,.1]}/><meshStandardMaterial color="#151719"/></mesh></group>
      {[[-4.2,-4.2],[4.2,-4.2],[-4.2,4.2],[4.2,4.2]].map(([x,z],i)=><group key={i} position={[x,-.2,z]}><mesh position={[0,.65,0]}><boxGeometry args={[1.1,1.1,1.1]}/><meshStandardMaterial color={['#631b2e','#172f61','#18442c','#5d4311'][i]} roughness={.8}/></mesh><mesh position={[0,1.45,.15]}><boxGeometry args={[1.3,.75,.28]}/><meshStandardMaterial color={['#8b2945','#244b91','#256544','#88631b'][i]}/></mesh></group>)}
    </group>
    <Environment preset="city"/><OrbitControls enablePan={false} minDistance={7.8} maxDistance={11} minPolarAngle={.45} maxPolarAngle={1.05} target={[0,0,0]}/>
  </>;
}

export default function Oligarchs() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState(createOligarchPlayers);
  const [owners, setOwners] = useState({});
  const [turn, setTurn] = useState(0); const [rolling, setRolling] = useState(false); const [dice, setDice] = useState([1,1]);
  const [log, setLog] = useState('Your campaign begins. Roll the dice.'); const [offer, setOffer] = useState(null); const [attack, setAttack] = useState(false); const [winner, setWinner] = useState(null);
  const active = players[turn];
  const weaponName = CAPTURE_ANIMATION_OPTIONS.find((w) => w.id === 'servicePistolAttack')?.label || 'Service Pistol';
  const tokenName = TOKEN_PIECE_OPTIONS[0]?.label || 'Royal token';

  const finishTurn = useCallback(() => setTimeout(() => setTurn((value) => (value + 1) % 4), 650), []);
  const resolveLanding = useCallback((playerId, position) => {
    const tile = TILES[position];
    const mustOffer = playerId === 0 && tile.type === 'asset' && owners[position] === undefined && players[playerId].cash >= tile.price;
    setPlayers((current) => {
      const next = current.map((p) => ({...p, assets:[...p.assets]})); const p = next[playerId]; const ownerId = owners[position];
      if (tile.type === 'asset' && ownerId === undefined && p.cash >= tile.price) { if (playerId !== 0 && p.cash > tile.price + 180) { p.cash -= tile.price; p.assets.push(position); setOwners((o)=>({...o,[position]:playerId})); setLog(`${p.name} acquired ${tile.name}.`); } }
      else if (tile.type === 'asset' && ownerId !== playerId) { const rival=next[ownerId]; const rent=Math.min(p.cash,tile.rent + rival.influence*3); p.cash-=rent; rival.cash+=rent; p.heat=Math.min(10,p.heat+1); setAttack(true); setTimeout(()=>setAttack(false),700); setLog(`${rival.name} collected $${rent} from ${p.name} using ${weaponName}.`); }
      else if (tile.type === 'tax') { const cost=Math.min(p.cash,100); p.cash-=cost; p.heat=Math.max(0,p.heat-1); setLog(`${p.name} paid $${cost} to contain the crisis.`); }
      else if (tile.type === 'tribunal') { p.jailed=1; p.heat=Math.max(0,p.heat-2); setLog(`${p.name} faces the tribunal and loses a turn.`); }
      else if (tile.type === 'card') { const good=Math.random()>.42; const amount=good?120:-90; p.cash=Math.max(0,p.cash+amount); p.influence=Math.max(0,p.influence+(good?1:-1)); setLog(good?`${p.name} completed a covert deal: +$120 and influence.`:`A leak hits ${p.name}: -$90 and influence.`); }
      else setLog(`${p.name} arrived at ${tile.name}.`);
      const victor=next.find((candidate)=>candidate.assets.length>=6 || next.filter(x=>x.cash>0).length===1); if(victor) setWinner(victor);
      return next;
    });
    if (mustOffer) setOffer(tile); else finishTurn();
  }, [finishTurn, owners, players, weaponName]);

  const roll = useCallback(() => {
    if (rolling || offer || winner) return; const current=players[turn];
    if (current.cash<=0) { setLog(`${current.name} is bankrupt.`); finishTurn(); return; }
    if (current.jailed>0) { setPlayers(ps=>ps.map(p=>p.id===turn?{...p,jailed:0}:p)); setLog(`${current.name} sits out at the tribunal.`); finishTurn(); return; }
    setRolling(true); const a=1+Math.floor(Math.random()*6), b=1+Math.floor(Math.random()*6); setDice([a,b]); setLog(`${current.name} rolled ${a + b}.`);
    setTimeout(()=>{ let landing=0; setPlayers(ps=>ps.map(p=>{if(p.id!==turn)return p; const raw=p.position+a+b; landing=raw%TILES.length; return {...p,position:landing,cash:p.cash+(raw>=TILES.length?200:0)};})); setRolling(false); setTimeout(()=>resolveLanding(turn,landing),250); },850);
  }, [finishTurn, offer, players, resolveLanding, rolling, turn, winner]);
  useEffect(()=>{ if(turn!==0 && !rolling && !offer && !winner){const timer=setTimeout(roll,900); return()=>clearTimeout(timer);} },[offer,roll,rolling,turn,winner]);
  const decidePurchase = (buy) => { if(buy){setPlayers(ps=>ps.map(p=>p.id===0?{...p,cash:p.cash-offer.price,assets:[...p.assets,offer.id]}:p));setOwners(o=>({...o,[offer.id]:0}));setLog(`You secured ${offer.name}. Global influence grows.`);} else setLog(`You passed on ${offer.name}.`); setOffer(null); finishTurn(); };
  const restart=()=>{setPlayers(createOligarchPlayers());setOwners({});setTurn(0);setWinner(null);setOffer(null);setLog('A new campaign begins. Roll the dice.');};

  return <main className="oligarchs-shell">
    <header className="oligarchs-top"><button onClick={()=>navigate('/games')} aria-label="Back to games"><ArrowLeft/></button><div><b>OLIGARCHS</b><small>Global dominance</small></div><button onClick={restart} aria-label="Restart"><RotateCcw/></button></header>
    <section className="oligarchs-scene"><Canvas shadows camera={{position:[0,8.4,7.7],fov:42}} dpr={[1,1.5]}><Board players={players} owners={owners} turn={turn} attack={attack}/></Canvas><div className="oligarchs-turn">{active.color === COLORS[0] ? 'YOUR MOVE' : active.name.toUpperCase()}</div></section>
    <section className="oligarchs-hud">
      <div className="oligarchs-stats">{players.map(p=><article key={p.id} className={p.id===turn?'active':''} style={{'--player':p.color}}><span>{p.name}</span><b>${p.cash}</b><small><Building2/> {p.assets.length} <Flame/> {p.heat} <Shield/> {p.influence}</small></article>)}</div>
      <motion.div key={log} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="oligarchs-log">{log}</motion.div>
      <div className="oligarchs-controls"><div className={rolling?'dice rolling':'dice'}><span>{dice[0]}</span><span>{dice[1]}</span></div><button disabled={turn!==0||rolling||Boolean(offer)||Boolean(winner)} onClick={roll}><Dice5/> {rolling?'ROLLING…':'ROLL DICE'}</button></div>
      <p className="oligarchs-loadout"><Crosshair/> {weaponName} takeover animation · {tokenName}</p>
    </section>
    <AnimatePresence>{offer&&<motion.div className="oligarchs-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div initial={{scale:.9,y:20}} animate={{scale:1,y:0}}><Coins/><small>{offer.group} opportunity</small><h2>{offer.name}</h2><p>Acquire for <b>${offer.price}</b><br/>Base revenue: ${offer.rent}</p><button onClick={()=>decidePurchase(true)}>ACQUIRE</button><button className="pass" onClick={()=>decidePurchase(false)}>Pass</button></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{winner&&<motion.div className="oligarchs-modal" initial={{opacity:0}} animate={{opacity:1}}><div><Trophy/><small>Campaign complete</small><h2>{winner.name} dominates</h2><p>{winner.assets.length} strategic assets under control.</p><button onClick={restart}>PLAY AGAIN</button></div></motion.div>}</AnimatePresence>
  </main>;
}
