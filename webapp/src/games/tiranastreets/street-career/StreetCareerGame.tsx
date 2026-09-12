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
import { screenStick, HUMAN_ROSTER } from './humanRoster.mjs';
import { CityMap } from '../map/CityMap';
import { StreetArsenal } from './StreetArsenal';
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
    [difficulty, setDifficulty] = useState('normal'),
    [stick, setStick] = useState({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  useEffect(() => {
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
            if (!cancelled) { g?.resume(); setPanel(null); }
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
  }, []);
  useEffect(() => {
    const d = modal.current;
    if (panel && d && !d.open) d.showModal();
    if (!panel) d?.close();
    return () => {
      d?.close();
    };
  }, [panel]);
  const reset = () => {
    if (stickId.current !== null)
      runtime.current?.input.pointerUp(stickId.current);
    stickId.current = null;
    setStick({ x: 0, y: 0 });
    if (runtime.current) {
      runtime.current.input.touch.x = 0;
      runtime.current.input.touch.y = 0;
    }
  };
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
  const drag = (e: PE<HTMLDivElement>) => {
    if (!runtime.current || view?.paused) return;
    const b = e.currentTarget.getBoundingClientRect(),
      s = screenStick(
        e.clientX - b.left - b.width / 2,
        e.clientY - b.top - b.height / 2
      );
    runtime.current.input.touch.x = s.x;
    runtime.current.input.touch.y = s.y;
    setStick({ x: s.x * 35, y: -s.y * 35 });
  };
  useEffect(() => {
    if (view?.paused) {
      stickId.current = null;
      setStick({ x: 0, y: 0 });
    }
  }, [view?.paused]);
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
        onClick={() => runtime.current?.action(a.id, a.targetId)}
      >
        {a.label}
        {!a.enabled && a.disabledReason && <small>{a.disabledReason}</small>}
      </button>
    ) : (
      <span key={slot} className={'tsc-slot-' + slot} />
    );
  };
  const [vehicleView,setVehicleView]=useState<'cockpit'|'chase'>('cockpit');
  const p = view?.state.players.local,
    flying = !!p?.aircraftId,
    aircraft = flying ? (p?.aircraftId === view?.state.jet?.id ? view?.state.jet : view?.state.helicopter) : undefined,
    driving = !!p?.carId,
    mission = campaign.chapters.find((m) => m.id === view?.state.missionId),
    target = mission?.stops[p?.index || 0];
  return (
    <main
      className={`tsc ${driving?'is-driving':flying?'is-flying':'is-on-foot'}`}
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
        <strong>
          TIRANA STREETS<small>STREET CAREER · SOLO</small>
        </strong>
        <button onClick={() => open('journal')}>JOURNAL</button>
        <button onClick={onExit}>EXIT</button>
      </header>
      {error && (
        <div className="tsc-error" role="alert">
          {error}
          <button onClick={onExit}>RETURN TO GAMES</button>
        </div>
      )}
      {!view?.ready && !error && <div className="tsc-loading" role="status">{loading}…</div>}
      {view && p && !panel && !error && (
        <>
          <section className="tsc-objective">
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
          </section>
          <nav className="tsc-tools">
            <button onClick={() => open('map')}>MAP</button>
            {driving&&<button aria-label="Change driving camera view" onClick={()=>{const next=vehicleView==='cockpit'?'chase':'cockpit';setVehicleView(next);if(runtime.current)runtime.current.renderer.vehicleView=next;}}>CAMERA · {vehicleView==='cockpit'?'COCKPIT':'CHASE'}</button>}
            <button onClick={() => open('arsenal')}>ARSENAL</button>
            {!driving && !flying && actionButton('holster', 'holster')}
          </nav>
          <div
            className="tsc-stick"
            role="group"
            aria-label={flying ? 'Aircraft steering and throttle' : driving ? 'Steer left or right' : 'Movement joystick'}
            onPointerDown={(e) => {
              if (stickId.current !== null) return;
              e.preventDefault();
              if (
                !runtime.current?.input.pointerDown(
                  e.pointerId,
                  'move',
                  e.clientX,
                  e.clientY
                )
              )
                return;
              stickId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag(e);
            }}
            onPointerMove={(e) => {
              if (stickId.current === e.pointerId) drag(e);
            }}
            onPointerUp={(e) => {
              if (stickId.current === e.pointerId) reset();
            }}
            onPointerCancel={(e) => {
              if (stickId.current === e.pointerId) reset();
            }}
            onLostPointerCapture={(e) => {
              if (stickId.current === e.pointerId) reset();
            }}
          >
            <span style={{ transform: `translate(${stick.x}px,${stick.y}px)` }}>
              ↑
            </span>
          </div>
          <div
            className={'tsc-reticle' + (view.body.aim ? ' is-aim' : '')}
            aria-label="Aim reticle"
          >
            <i />
            <i />
          </div>
          <div className="tsc-actions">
            {actionButton('interact', 'context')}
            {flying ? (
              <>
                <button className="tsc-slot-aim" aria-label="Climb" {...pointer('ascend')}>UP</button>
                <button className="tsc-slot-secondary" aria-label="Descend and land" {...pointer('brake')}>DOWN</button>
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
                {actionButton(p.weapon ? 'aim' : 'guard', 'aim')}
                {actionButton(p.weapon ? 'reload' : 'kick', 'secondary')}
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
                {actionButton('sprint', 'sprint')}
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
      {panel && !error && (
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
                    <div className="tsc-chapters">
                      {campaign.chapters.map((m, i) => (
                        <button
                          key={m.id}
                          disabled={!campaign.available(view.profile,m.id)}
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
                    <details>
                      <summary>World sources & models</summary>
                      <p>Map data © OpenStreetMap contributors · ODbL. Terrain: Mapzen; Europe terrain produced using Copernicus data and information funded by the European Union – EU-DEM layers; SRTM/GMTED2010 courtesy of USGS. Buildings and cableway: original Blender models informed by public photographs. The city datum and terrain seam are adapted for gameplay.</p>
                    </details>
                    <details>
                      <summary>Shared human cast</summary>
                      <p>{HUMAN_ROSTER.map((h) => h.label).join(' · ')}</p>
                      <p>
                        Civilians and patrols reuse the existing human rigs; the
                        military uses the existing soldier. Original model
                        licences remain in force.
                      </p>
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
                      {(
                        [
                          'fov',
                          'sensitivity',
                          'headBob',
                          'shake',
                          'buttonSize',
                          'opacity',
                          'volume'
                        ] as const
                      ).map((key) => {
                        const names = {
                          fov: 'Field of view',
                          sensitivity: 'Look sensitivity',
                          headBob: 'Head bob',
                          shake: 'Camera shake',
                          buttonSize: 'Button size',
                          opacity: 'Control opacity',
                          volume: 'Sound volume'
                        };
                        const bounds = {
                          fov: [60, 90, 1],
                          sensitivity: [0.4, 2, 0.1],
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
                    <label>
                      Graphics{' '}
                      <select
                        defaultValue="auto"
                        onChange={(e) =>
                          runtime.current?.renderer.setQuality(
                            e.target.value as 'auto' | 'high' | 'battery'
                          )
                        }
                      >
                        <option value="auto">Automatic</option>
                        <option value="high">High</option>
                        <option value="battery">Battery saver</option>
                      </select>
                    </label>
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
