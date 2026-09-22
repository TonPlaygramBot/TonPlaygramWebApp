import {GraphicsControl} from '../GraphicsControl';
import {FrameRateControl} from '../FrameRateControl';
import {MovementStick} from '../MovementStick';
import '../weapon-switcher.css';
import {useEffect, useRef, useState} from 'react';
import {CareerRuntime, type CareerView} from './CareerRuntime';
import {CHAPTERS, currentStep, careerBalance} from './careerCore.mjs';
import {CityMap} from '../map/MapPanel';
import './career.css';
const storage = () => { try { return window.localStorage; } catch { return undefined; } };
/** City Stories shares the original city, player and device-local career save. */
export function CareerGame({onExit}: {onExit: () => void}) {
  const canvas = useRef<HTMLCanvasElement>(null), surface = useRef<HTMLDivElement>(null), runtime = useRef<CareerRuntime | null>(null);
  const [view, setView] = useState<CareerView | null>(null), [error, setError] = useState(''), [map, setMap] = useState(false);
  const [page, setPage] = useState<'jobs' | 'settings'>('jobs');
  const resumeAfterMap = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let game: CareerRuntime | undefined;
    try {
      if (canvas.current && surface.current) {
        game = new CareerRuntime(canvas.current, surface.current, setView, storage());
        runtime.current = game;
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Career could not load.'); }
    return () => { game?.dispose(); runtime.current = null; };
  }, []);
  useEffect(() => { if (map) dialog.current?.showModal(); return () => dialog.current?.close(); }, [map]);
  const reset = () => { if (runtime.current) runtime.current.input.move = {x: 0, y: 0}; };
  const closeMap = () => { setMap(false); if (resumeAfterMap.current) runtime.current?.resume(); resumeAfterMap.current = false; };
  const openMap = () => { resumeAfterMap.current = !view?.paused; runtime.current?.pause(); reset(); setMap(true); };
  const step = view ? currentStep(view.profile) : null, active = CHAPTERS.find(c => c.id === view?.profile.active?.id);
  const progress = active ? (view?.profile.active?.step || 0) / active.steps.length : 0;
  return <main className={`tc-game${view?.settings.leftHanded ? ' is-left-handed' : ''}`} aria-label="Tirana Streets career">
    <canvas ref={canvas}/><div ref={surface} className="tc-look" aria-label="Drag to look around"/>
    <header className="tc-header">
      <strong>TIRANA STREETS<small>CITY STORIES</small></strong>
      {view && !view.paused && <button onClick={openMap} aria-label="Open city map">MAP</button>}
      <button className="tc-menu-button" onClick={() => { setPage('jobs'); runtime.current?.pause(); }}>MENU</button>
      <button onClick={onExit}>EXIT</button>
    </header>
    {error ? <section className="tc-journal" role="alert"><h2>Career could not start</h2><p>{error}</p><button onClick={onExit}>Back to game</button></section> : !view ? <p className="tc-status" role="status">Loading the shared Tirana city…</p> : <>
      {!view.paused && <section className="tc-objective" aria-label="Current objective">
        <div><small>{active?.title || 'FREE EXPLORATION'}</small>{active?.limit && <time>{Math.max(0, Math.ceil(active.limit - (view.profile.active?.elapsed || 0)))}s</time>}</div>
        <strong>{step?.text || 'Explore Tirana. Open the journal when you are ready for a job.'}</strong>
        {active && <progress max={1} value={progress} aria-label="Chapter progress"/>}
        <span>{active ? `Stage ${Math.min((view.profile.active?.step || 0) + 1, active.steps.length)} / ${active.steps.length}` : 'Follow the streets and discover the city'}{Number.isFinite(view.distance) && step ? ` · ${Math.round(view.distance)} m` : ''}</span>
      </section>}
      {!view.paused && !view.ride && !view.overlook && <>
        <MovementStick className="tc-stick" label="Movement joystick" disabled={view.paused || view.ride || view.overlook} deadzone={view.settings.joystickDeadzone}
          claim={() => !!runtime.current?.input.active} release={reset} move={(x,y) => { if (runtime.current) runtime.current.input.move = {x,y}; }}/>
        {step && <div className="tc-context-action">
          <span>{view.distance <= 4 ? 'AT DESTINATION' : Number.isFinite(view.distance) ? `${Math.round(view.distance)} m to destination` : 'Follow your route'}</span>
          <button className="tc-interact" disabled={view.distance > 4} onClick={() => runtime.current?.interact()}>{step.action === 'ride' ? 'TRAVEL TO DAJTI' : step.action === 'inspect' ? 'OBSERVE' : step.action === 'deliver' ? 'DELIVER' : 'TALK'}</button>
        </div>}
        <p className="tc-controls">Move: {view.settings.leftHanded ? 'right' : 'left'} stick · Look: drag the view · Interact: E</p>
      </>}
      {view.settings.showPerformance && !view.paused && <output className="tc-performance" aria-label="Frame rate">{view.fps} FPS</output>}
      {view.overlook && !view.paused && <section className="tc-ride"><strong>PANORAMA E TIRANËS · DAJTI</strong><p>Rrëshqit për të parë qytetin dhe horizontin drejt Durrësit.</p><button onClick={() => runtime.current?.returnFromOverlook()}>KTHEHU NË QYTET</button></section>}
      {view.ride && !view.paused && <section className="tc-ride"><strong>DAJTI EKSPRES</strong><progress max={1} value={view.rideProgress} aria-label="Cable-car journey"/><p>Watch Tirana fall away below you. Drag to look around during the 90-second journey.</p><button onClick={() => runtime.current?.cancel()}>Return to city without completing</button></section>}
      {view.paused && !map && <section className="tc-journal" aria-label="Career journal">
        <small>CITY STORIES · SAVED ON THIS DEVICE</small><h1>Your name in Tirana.</h1>
        <nav className="tc-tabs" aria-label="Career menu">
          <button aria-pressed={page === 'jobs'} onClick={() => setPage('jobs')}>JOBS & PROGRESS</button>
          <button aria-pressed={page === 'settings'} onClick={() => setPage('settings')}>SETTINGS</button>
        </nav>
        {page === 'jobs' ? <>
          <div className="tc-balance"><strong>{careerBalance(view.profile)}</strong> career credits <span>{view.profile.completed.length}/{CHAPTERS.length} chapters · Not TPG</span></div>
          {view.profile.active && <section className="tc-checkpoint" aria-label="Saved checkpoint">
            <strong>{active?.title}</strong>
            <p role="status">{view.profile.active.status === 'failed' ? view.profile.active.reason : `Checkpoint saved: ${step?.text || active?.title}`}</p>
            {active && view.profile.active.status === 'active' && <ol>{active.steps.map((item, index) => <li key={`${item.place}-${index}`} aria-current={index === view.profile.active?.step ? 'step' : undefined} className={index < (view.profile.active?.step || 0) ? 'is-complete' : ''}>{item.text}</li>)}</ol>}
            <button onClick={openMap}>SHOW ROUTE</button>
          </section>}
          {!view.playerReady && (view.playerError ? <div role="alert"><p>{view.playerError}</p><button onClick={() => void runtime.current?.loadPlayer()}>Retry player download</button></div> : <p role="status">Loading your selected player…</p>)}
          <button className="tc-primary" disabled={!view.playerReady} onClick={() => runtime.current?.freeExplore()}>{view.profile.active?.status === 'active' ? 'CONTINUE JOB' : 'FREE EXPLORATION'}</button>
          <h2>Chapter board</h2>
          {CHAPTERS.map((chapter, i) => {
            const locked = i > view.profile.completed.length, blocked = view.blocked.includes(chapter.id), completed = view.profile.completed.includes(chapter.id);
            return <button className="tc-chapter" key={chapter.id} disabled={!view.playerReady || locked || blocked} onClick={() => runtime.current?.select(chapter.id)}>
              <span>{completed ? '✓' : String(i + 1).padStart(2, '0')}</span><div><strong>{chapter.title}</strong>
                <small>{blocked ? 'Mapped access unavailable' : locked ? 'Complete the previous chapter' : completed ? `Replay${view.profile.grades[chapter.id] ? ` · ${view.profile.grades[chapter.id].toUpperCase()}` : ''} · No duplicate rewards` : `${chapter.contact} · ${chapter.reward} career credits`}</small>
                <small>{chapter.steps.length} stages{chapter.limit ? ` · ${Math.round(chapter.limit / 60)} minute limit` : ' · Explore at your pace'}{Number.isFinite(view.profile.bestTimes[chapter.id]) ? ` · Best ${Math.ceil(view.profile.bestTimes[chapter.id])}s` : ''}</small>
              </div>
            </button>;
          })}
        </> : <section aria-label="Graphics and controls">
          <h2>Graphics & performance</h2>
          <FrameRateControl value={view.settings.targetFps} onChange={targetFps => runtime.current?.setSettings({targetFps})}/>
          <GraphicsControl value={view.settings.quality} onChange={quality => runtime.current?.setSettings({quality})}/>
          <label>Show frame rate<input type="checkbox" checked={view.settings.showPerformance} onChange={e => runtime.current?.setSettings({showPerformance:e.target.checked})}/></label>
          <h2>Controls & comfort</h2>
          <label>Look sensitivity<input aria-label="Look sensitivity" type="range" min="0.4" max="2" step="0.05" value={view.settings.sensitivity} onChange={e => runtime.current?.setSettings({sensitivity:Number(e.target.value)})}/></label>
          <label>Joystick dead zone<input aria-label="Joystick dead zone" type="range" min="0" max="0.25" step="0.01" value={view.settings.joystickDeadzone} onChange={e => runtime.current?.setSettings({joystickDeadzone:Number(e.target.value)})}/></label>
          <label>Left-handed layout<input type="checkbox" checked={view.settings.leftHanded} onChange={e => runtime.current?.setSettings({leftHanded:e.target.checked})}/></label>
          <p>WASD to move. Drag the view to look. E to interact. The journal pauses solo play.</p>
          <button className="tc-primary" disabled={!view.playerReady} onClick={() => runtime.current?.freeExplore()}>SAVE & CONTINUE</button>
          <details><summary>World & credits</summary><p>Fictional contacts in the shared Tirana city. Original player textures and building models. Dajti relief, support positions and elevations are approximate; the transfer from the city is not a modeled road.</p></details>
        </section>}
        {!view.storageOK && <p role="alert">Device storage is unavailable. Progress will last for this session only.</p>}
        {view.assetErrors.length > 0 && <details><summary>Asset loading problems</summary>{view.assetErrors.map((e,i) => <p key={i}>{e}</p>)}</details>}
      </section>}
      {map && <dialog ref={dialog} className="tc-map-dialog" aria-label="Career city map" onCancel={e => { e.preventDefault(); closeMap(); }}><header><h2>CAREER · CITY MAP</h2><button onClick={closeMap}>CLOSE</button></header><CityMap player={view.player} state={null} route={view.route} large routeNotice={view.routeNotice}/><p>Career route shown in green. Solo play is paused.</p></dialog>}
    </>}
  </main>;
}
