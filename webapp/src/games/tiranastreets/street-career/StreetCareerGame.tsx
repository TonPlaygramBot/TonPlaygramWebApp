import {GraphicsControl} from '../GraphicsControl';
import {MovementStick} from '../MovementStick';
import {DEFAULT_SETTINGS} from './settings';
import {LiveHud} from '../LiveHud';
import {OpticalSight} from '../OpticalSight';
import {touchAction} from '../touchActions';
import {weaponAnchors} from './weaponPose.mjs';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as PE,
  type CSSProperties
} from 'react';
import {
  StreetCareerRuntime,
  campaign,
  type StreetView
} from './StreetCareerRuntime';
import { CityMap } from '../map/MapPanel';
import { StreetArsenal } from './StreetArsenal';
import {WeaponSwitcher} from '../WeaponSwitcher';
import {FrameRateControl} from '../FrameRateControl';
import { difficultyOf, WEAPON_BY_ID } from '../shared/weapons.mjs';
import { wantedStars } from '../shared/cityLife.mjs';
import { MISSION_REQUIREMENTS } from './campaignCore.mjs';
import '../city.css';
import './street-career.css';
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};
type Panel = 'journal' | 'arsenal' | 'map' | null;
export function StreetCareerGame({ onExit }: { onExit: () => void }) {
  const root = useRef<HTMLDivElement>(null),
    runtime = useRef<StreetCareerRuntime>(),
    modal = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<StreetView | null>(null),
    [panel, setPanel] = useState<Panel>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState('Loading Tirana'),
    [difficulty, setDifficulty] = useState('normal');
  const [session, setSession] = useState(0);
  useEffect(() => {
    setError('');
    setView(null);
    setPanel(null);
    setLoading('Loading Tirana');
    let g: StreetCareerRuntime | undefined,
      cancelled = false;
    try {
      if (root.current) {
        g = new StreetCareerRuntime(
          root.current,
          (v) => {
            if (!cancelled) setView({ ...v });
          },
          storage(),
          (p) => {
            if (!cancelled) setPanel(p);
          }
        );
        runtime.current = g;
        void g
          .load((m) => {
            if (!cancelled) setLoading(m);
          })
          .then(() => {
            if (!cancelled) {
              if (document.hidden) setPanel('journal');
              else { g?.resume(); setPanel(null); }
            }
          })
          .catch((e) => {
            if (!cancelled) setError(String(e));
          });
      }
    } catch (e) {
      setError(String(e));
    }
    return () => {
      cancelled = true;
      g?.dispose();
      runtime.current = undefined;
    };
  }, [session]);
  useEffect(() => {
    const d = modal.current;
    if (panel && d && !d.open) d.showModal();
    if (!panel) d?.close();
    return () => {
      d?.close();
    };
  }, [panel]);
  const reset = () => runtime.current?.input.releaseAll();
  const open = (p: Panel) => {
    runtime.current?.pause();
    reset();
    setPanel(p);
  };
  const resume = () => {
    const g = runtime.current;
    if (!g?.ready || g.state.phase === 'finished') return;
    setPanel(null);
    g.resume();
  };
  const start = (id: string) => {
    if (runtime.current?.start(id, difficulty)) setPanel(null);
  };
  const pointer = (kind: string) => ({
    onPointerDown: (e: PE<HTMLElement>) => {
      e.preventDefault();
      if (view?.paused) return;
      if (
        runtime.current?.input.pointerDown(
          e.pointerId,
          kind,
          e.clientX,
          e.clientY
        )
      )
        e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PE<HTMLElement>) =>
      runtime.current?.input.pointerMove(e.pointerId, e.clientX, e.clientY),
    onPointerUp: (e: PE<HTMLElement>) =>
      runtime.current?.input.pointerUp(e.pointerId),
    onPointerCancel: (e: PE<HTMLElement>) =>
      runtime.current?.input.pointerUp(e.pointerId),
    onLostPointerCapture: (e: PE<HTMLElement>) =>
      runtime.current?.input.pointerUp(e.pointerId)
  });
  const primary = view?.actions.find(
    (a) => a.id === 'fire' || a.id === 'punch'
  );
  const actionButton = (id: string, slot: string) => {
    const a = view?.actions.find((a) => a.id === id && a.visible);
    return a ? (
      <button
        key={slot}
        className={'tsc-action tsc-slot-' + slot}
        aria-label={a.label}
        aria-disabled={!a.enabled}
        title={a.disabledReason || a.label}
        data-action={a.id}
        data-enabled={a.enabled}
        {...touchAction(() => { runtime.current?.action(a.id, a.targetId); }, a.enabled)}
      >
        {a.label}
        {!a.enabled && a.disabledReason && <small>{a.disabledReason}</small>}
      </button>
    ) : (
      <span key={slot} className={'tsc-slot-' + slot} />
    );
  };
  const [vehicleView,setVehicleView]=useState<'cockpit'|'chase'>('cockpit');
  const failure = error || view?.graphicsError;
  const p = view?.state.players.local,
    flying = !!p?.aircraftId,
    aircraft = flying ? (p?.aircraftId === view?.state.jet?.id ? view?.state.jet : view?.state.helicopters?.find(a=>a.id===p?.aircraftId)) : undefined,
    driving = !!p?.carId,
    mission = campaign.chapters.find((m) => m.id === view?.state.missionId),
    target = mission?.stops[p?.index || 0];
  return (
    <main
      className={`tsc ${driving?'is-driving':flying?'is-flying':'is-on-foot'}${view?.settings.leftHanded?' is-left-handed':''}`}
      style={
        {
          '--action-size': `${view?.settings.buttonSize || 54}px`,
          '--control-opacity': view?.settings.opacity || 0.85
        } as CSSProperties
      }
      aria-label="Tirana Streets solo career"
    >
      <div ref={root} className="tsc-world" />
      <div
        className="tsc-look"
        aria-label="Drag to look"
        {...pointer('look')}
        onContextMenu={(e) => e.preventDefault()}
      />
      <header className="tsc-header">

        <button className="tsc-map-button" aria-label="Open city map" onClick={() => open('map')}>MAP</button>
        <button className="tsc-menu-button" onClick={() => open('journal')}>MENU</button>
        <button onClick={onExit}>EXIT</button>
      </header>
      {p && <LiveHud health={p.health} />}
      {failure && (
        <div className="tsc-error" role="alert">
          {failure}
          <button onClick={() => { reset(); setVehicleView('cockpit'); setSession(s => s + 1); }}>RETRY</button>
          <button onClick={onExit}>RETURN TO GAMES</button>
        </div>
      )}
      {!view?.ready && !failure && <div className="tsc-loading" role="status">{loading}…</div>}
      {view?.ready && p && !panel && !failure && (
        <>
          {mission && <section className="tsc-objective">
            <small>{mission?.title || 'FREE ROAM'}</small>
            <strong>
              {view.state.phase === 'finished'
                ? view.state.message
                : view.objective.title}
            </strong>
            <span>{view.objective.detail}</span>
            <span>
              Health {Math.ceil(p.health)} · ${p.cash} street cash ·{' '}
              {'★'.repeat(wantedStars(p.wanted)) || 'No pursuit'}
            </span>
            <span>
              {mission
                ? `${Math.max(0, Math.ceil(mission.time * difficultyOf(view.state.difficulty).time - view.state.elapsed))}s · ${p.index}/${mission.stops.length} stops`
                : ''}{' '}
              {Math.round(view.body.stamina)} stamina
            </span>
            {view.state.objectiveRemaining !== undefined &&
              mission?.type === 'combat' && (
                <span>{view.state.objectiveRemaining} opponents remaining</span>
              )}
          </section>}
          {!mission && <div className="tsc-vitals" aria-label="Player status">♥ {Math.ceil(p.health)} · ${p.cash}{p.wanted > 0 && ` · ${'★'.repeat(wantedStars(p.wanted))}`}</div>}
          <nav className="tsc-tools">
            {driving&&<button aria-label="Change driving camera view" onClick={()=>{const next=vehicleView==='cockpit'?'chase':'cockpit';setVehicleView(next);if(runtime.current)runtime.current.renderer.vehicleView=next;}}>CAMERA · {vehicleView==='cockpit'?'COCKPIT':'CHASE'}</button>}
          </nav>
          {!driving && !flying && <WeaponSwitcher
            selected={p.weapon || ''}
            disabled={p.health <= 0 || p.finished || p.failed || !!p.arrest && p.arrest.phase!=='pursuit'}
            weapons={[{id:'',label:'No weapon',icon:'✋'},...Object.entries(p.inventory).flatMap(([id, ammo]) => {
              const w = WEAPON_BY_ID.get(id);
              return w ? [{id, label: w.label, icon:({punch:'✊',egg:'🥚',tomato:'🍅'} as Record<string,string>)[id], category:w.category, thumbnail: `/assets/tirana-streets/weapon-thumbnails/${id}.webp`,
                ammo: w.category === 'melee' ? undefined : ammo.ammo, reserve: ammo.reserve}] : [];
            })]}
            onSelect={id => runtime.current?.action(`equip:${id}`) ?? false}
          />}
          <MovementStick className="tsc-stick"
            label={flying ? 'Aircraft steering and throttle' : driving ? 'Steer left or right' : 'Movement joystick'}
            disabled={view.paused || !view.ready || !!failure}
            deadzone={view.settings.joystickDeadzone}
            claim={(id,x,y)=>runtime.current?.input.pointerDown(id,'move',x,y) ?? false}
            release={id=>runtime.current?.input.pointerUp(id)}
            move={(x,y)=>{if(runtime.current){runtime.current.input.touch.x=x;runtime.current.input.touch.y=y;}}}>
            {!driving && !flying && <button className="ts-joystick-sprint" aria-label="Toggle sprint" aria-pressed={view.body.sprint}
              {...touchAction(()=>{runtime.current?.action('sprint');})}>SPRINT {view.body.sprint?'ON':'OFF'}</button>}
          </MovementStick>
          {view.body.aim && !view.body.action && view.body.wall>=.8 && !driving && !flying && weaponAnchors(p.weapon).zoom>1 ? <OpticalSight zoom={weaponAnchors(p.weapon).zoom}/> : <div
            className={'tsc-reticle' + (view.body.aim ? ' is-aim' : '')}
            aria-label="Aim reticle"
          >
            <i />
            <i />
          </div>}
          {p.arrest && p.arrest.phase!=='pursuit' && <div className={'tsc-custody tsc-custody-'+p.arrest.phase} role="status">
            <strong>{view.body.notice}</strong><span>Drejtoria e Policisë Tiranë · pranë Myslym Shyrit</span>
            <progress aria-label="Arrest sequence" max="5" value={['spray','down','backup','escort','transport'].indexOf(p.arrest.phase)+1}/>
          </div>}
          <div className="tsc-actions">
            {actionButton('interact', 'context')}
            {flying ? (
              <>
                <button className="tsc-slot-aim" aria-label="Climb" {...pointer('ascend')}>UP</button>
                <button className="tsc-slot-secondary" aria-label="Descend and land" {...pointer('brake')}>DOWN</button>
                <button className="tsc-slot-jump" onClick={()=>runtime.current?.simulation.flight.assist('hover')}>HOVER</button>
                <button className="tsc-slot-crouch" onClick={()=>runtime.current?.simulation.flight.assist('land')}>LAND</button>
                <button className="tsc-slot-primary" aria-label="Fire missile" {...pointer('fire')}>MISSILE<small>{aircraft?.missiles ?? 0}</small></button>
              </>
            ) : driving ? (
              <>
                <button className="tsc-slot-secondary" {...pointer('reverse')}>
                  REVERSE
                </button>
                <button className="tsc-slot-primary" {...pointer('gas')}>
                  GAS
                </button>
                <button className="tsc-slot-jump" {...pointer('brake')}>
                  BRAKE
                </button>
              </>
            ) : (
              <>
                {actionButton(p.weapon && p.weapon!=='punch' ? 'aim' : 'guard', 'aim')}
                {actionButton(p.weapon && p.weapon!=='punch' ? 'reload' : 'kick', 'secondary')}
                {actionButton('jump', 'jump')}
                {primary && (
                  <button
                    className="tsc-slot-primary"
                    aria-label={primary.label}
                    aria-disabled={!primary.enabled}
                    data-action={primary.id}
                    data-enabled={primary.enabled}
                    {...pointer('fire')}
                  >
                    {primary.label}
                    <small>
                      {primary.enabled ? 'hold + drag' : primary.disabledReason}
                    </small>
                  </button>
                )}
                {actionButton('crouch', 'crouch')}

                {actionButton('vault', 'vault')}
              </>
            )}
          </div>
          {(view.body.notice ||
            view.actions.find(
              (a) => a.visible && !a.enabled && a.id === 'interact'
            )?.disabledReason) && (
            <p className="tsc-notice" role="status">
              {view.body.notice ||
                view.actions.find((a) => a.id === 'interact')?.disabledReason}
            </p>
          )}
          {view.settings.showPerformance && <output className="tsc-performance" aria-label="Performance statistics">
            {view.fps} FPS · p95 {view.metrics.p95} ms<br/>{view.metrics.drawCalls} draws · {Math.round(view.metrics.triangles/1000)}k triangles
          </output>}
          <footer>
            {flying ? `${aircraft?.kind === 'jet' ? 'Fighter jet' : 'Helicopter'} · ${Math.round(aircraft?.y || 0)} m · ${Math.round(p.speed * 3.6)} km/h` : driving
              ? 'Steer: left stick · Pedals: right'
              : 'Move: left stick · Look: right drag'}
            {!driving && !flying && p.weapon && (
              <small>
                {WEAPON_BY_ID.get(p.weapon)?.label} ·{' '}
                {p.inventory[p.weapon]?.ammo || 0}/
                {p.inventory[p.weapon]?.reserve || 0}
              </small>
            )}
          </footer>
        </>
      )}
      {panel && !failure && (
        <dialog
          ref={modal}
          className="tsc-dialog"
          aria-label={
            panel === 'journal'
              ? 'Career journal'
              : panel === 'arsenal'
                ? 'Street arsenal'
                : 'Tirana city map'
          }
          onCancel={(e) => {
            e.preventDefault();
            resume();
          }}
        >
          <header>
            <h2>
              {panel === 'journal'
                ? 'Your name in Tirana'
                : panel === 'arsenal'
                  ? 'Arben · Arsenal'
                  : 'Tirana city map'}
            </h2>
            <button
              disabled={!view?.ready || view.state.phase === 'finished'}
              onClick={resume}
            >
              RESUME
            </button>
          </header>
          {!view?.ready ? (
            <p role="status">{loading}…</p>
          ) : (
            view &&
            p && (
              <>
                {panel === 'journal' ? (
                  <>
                    <section aria-label="Graphics and performance">
                      <h3>Graphics & performance</h3>
                      <FrameRateControl value={view.settings.targetFps} onChange={targetFps => runtime.current?.setSettings({targetFps})}/>
                      <GraphicsControl value={view.settings.quality} resolved={runtime.current?.renderer.quality} onChange={quality=>runtime.current?.setSettings({quality})} />
                      <p>{view.fps} FPS · {view.metrics.p95} ms frame time (95th percentile)</p>
                      <label>Show performance <input type="checkbox" checked={view.settings.showPerformance} onChange={e=>runtime.current?.setSettings({showPerformance:e.target.checked})}/></label>
                    </section>
                    <p>
                      Explore on foot, steal a ride or fly. Complete jobs to unlock
                      new contacts, harder missions and your next story.
                    </p>
                    <p>
                      <strong>
                        {view.profile.completed.length}/
                        {campaign.chapters.length} chapters
                      </strong>{' '}
                      · ${p.cash} street cash · Saved on this device, not TPG.
                    </p>
                    {view.state.phase === 'finished' && (
                      <p role="status">
                        {view.state.message}
                        {p.finished && !p.failed
                          ? ' Completion saved. Replays do not pay a second reward.'
                          : ''}
                      </p>
                    )}
                    {view.profile.active && (
                      <>
                        <p>
                          Checkpoint:{' '}
                          {
                            campaign.chapters.find(
                              (m) => m.id === view.profile.active?.id
                            )?.title
                          }
                          . Continue from the latest saved stage, position and
                          loadout.
                        </p>
                        <button
                          onClick={() => {
                            if (runtime.current?.retry()) setPanel(null);
                          }}
                        >
                          RETRY CHECKPOINT
                        </button>
                      </>
                    )}
                    <button
                      className="tsc-primary"
                      onClick={() => {
                        runtime.current?.explore();
                        setPanel(null);
                      }}
                    >
                      {view.profile.active
                        ? 'END JOB & FREE ROAM'
                        : 'FREE ROAM'}
                    </button>
                    <label>
                      Difficulty{' '}
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        <option value="easy">Explorer</option>
                        <option value="normal">Street</option>
                        <option value="hard">Veteran</option>
                      </select>
                    </label>
                    {!view.profile.active && <section aria-label="Available jobs">
                      <h3>Next jobs</h3>
                      <div className="tsc-chapters">
                        {campaign.chapters.filter(m=>campaign.available(view.profile,m.id)&&!view.profile.completed.includes(m.id)).slice(0,3).map(m=><button key={m.id} onClick={()=>start(m.id)}>
                          <strong>{m.title}</strong><span>{m.description}</span>
                          <small>${Math.round(m.reward*difficultyOf(difficulty).reward)} · {m.stops.length} stops</small>
                        </button>)}
                        {view.profile.completed.length===campaign.chapters.length&&<p>All jobs completed. Explore freely or replay a chapter below.</p>}
                      </div>
                    </section>}
                    {view.profile.active&&<p>Finish your current job or end it to choose another.</p>}
                    <details><summary>All chapters & replays</summary>
                    <div className="tsc-chapters">
                      {campaign.chapters.map((m, i) => (
                        <button
                          key={m.id}
                          disabled={!!view.profile.active || !campaign.available(view.profile,m.id)}
                          onClick={() => start(m.id)}
                        >
                          <strong>
                            {i + 1}. {m.title}
                          </strong>
                          <small>
                            {!campaign.available(view.profile,m.id)
                              ? `Requires: ${(MISSION_REQUIREMENTS[m.id]||[]).map(id=>campaign.chapters.find(c=>c.id===id)?.title).join(' + ')}`
                              : view.profile.completed.includes(m.id)
                                ? 'Completed · Replay without duplicate payout'
                                : `${m.type} · $${Math.round(m.reward * difficultyOf(difficulty).reward)} first completion`}
                          </small>
                          <span>{m.description}</span>
                        </button>
                      ))}
                    </div>
                    </details>
                    <details>
                      <summary>World sources & models</summary>
                      <p>Map data © OpenStreetMap contributors · ODbL. Terrain: Mapzen; Europe terrain produced using Copernicus data and information funded by the European Union – EU-DEM layers; SRTM/GMTED2010 courtesy of USGS. Buildings and cableway: original Blender models informed by public photographs. The city datum and terrain seam are adapted for gameplay.</p>
                    </details>
                    <details>
                      <summary>Controls & comfort</summary>
                      <p>Explore Farkë, Surrel, Kinostudio and the Dajti trails. Approach a cable station and tap HIP for the 15-minute Dajti Ekspres ride. You can walk freely after arriving.</p>
                      <p>
                        WASD / arrows · Mouse drag to look · F fire · Space jump
                        · C crouch · Shift sprint · Z aim · V kick · B guard · E
                        interact · R reload · H draw / holster · Esc pause.
                        Aircraft: left stick steers and controls speed; UP climbs,
                        DOWN descends. Land and stop to exit and rearm. Drag to aim missiles.
                      </p>
                      <label>Control layout <select aria-label="Control layout" value={view.settings.leftHanded?'left':'standard'} onChange={e=>runtime.current?.setSettings({leftHanded:e.target.value==='left'})}>
                        <option value="standard">Move left · Actions right</option><option value="left">Move right · Actions left</option>
                      </select></label>
                      <button onClick={()=>runtime.current?.setSettings({...DEFAULT_SETTINGS})}>Reset settings</button>
                      {(
                        [
                          'fov',
                          'sensitivity',
                          'aimSensitivity',
                          'joystickDeadzone',
                          'buttonSize',
                          'opacity',
                          'shake',
                          'volume'
                        ] as const
                      ).map((key) => {
                        const names = {
                          fov: 'Field of view',
                          sensitivity: 'Look sensitivity',
                          aimSensitivity: 'Aim sensitivity',
                          joystickDeadzone: 'Joystick dead zone',
                          headBob: 'Head bob',
                          shake: 'Camera shake',
                          buttonSize: 'Button size',
                          opacity: 'Control opacity',
                          volume: 'Sound volume'
                        };
                        const bounds = {
                          fov: [60, 90, 1],
                          sensitivity: [0.4, 2, 0.1],
                          aimSensitivity: [0.2, 1.2, 0.05],
                          joystickDeadzone: [0, 0.25, 0.01],
                          headBob: [0, 1, 0.1],
                          shake: [0, 1, 0.1],
                          buttonSize: [48, 64, 2],
                          opacity: [0.3, 1, 0.05],
                          volume: [0, 1, 0.1]
                        }[key];
                        return (
                          <label key={key}>
                            {names[key]}
                            <input
                              aria-label={names[key]}
                              type="range"
                              min={bounds[0]}
                              max={bounds[1]}
                              step={bounds[2]}
                              value={view.settings[key]}
                              onChange={(e) =>
                                runtime.current?.setSettings({
                                  [key]: Number(e.target.value)
                                })
                              }
                            />
                          </label>
                        );
                      })}
                      <label>
                        Light aim assist
                        <input
                          type="checkbox"
                          checked={view.settings.aimAssist}
                          onChange={(e) =>
                            runtime.current?.setSettings({
                              aimAssist: e.target.checked
                            })
                          }
                        />
                      </label>
                    </details>
                  </>
                ) : panel === 'arsenal' ? (
                  <StreetArsenal
                    player={p}
                    state={view.state}
                    onAction={(a) => runtime.current?.action(a)}
                    onOwned={(ids) => runtime.current?.grantWeapons(ids)}
                  />
                ) : (
                  <CityMap
                    player={p}
                    state={view.state}
                    route={view.route}
                    large
                    destination={view.destination}
                    onDestination={place => runtime.current?.setDestination(place)}
                    routeNotice={view.routeNotice}
                    jobs={campaign.chapters.map(m => ({id:m.id,name:m.title,detail:m.description,available:campaign.available(view.profile,m.id),completed:view.profile.completed.includes(m.id),active:view.state.phase!=='finished'&&m.id===view.state.missionId,point:m.stops[0]}))}
                    onStartJob={start}
                    task={mission ? {name:view.objective.title,detail:view.objective.detail,point:target} : undefined}
                  />
                )}
                {!view.storageOK && (
                  <p role="alert">
                    Device storage unavailable. Progress is session-only.
                  </p>
                )}
                {!!view.assetErrors.length && (
                  <details>
                    <summary>
                      Asset problems ({view.assetErrors.length})
                    </summary>
                    {view.assetErrors.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                  </details>
                )}
              </>
            )
          )}
          <button onClick={onExit}>BACK TO OPERATION / CITY STORIES</button>
        </dialog>
      )}
    </main>
  );
}
