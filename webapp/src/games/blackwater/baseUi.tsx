'use client';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointer
} from 'react';
import {
  ArrowUpRight,
  Crosshair,
  Focus,
  RotateCw,
  Pause,
  Play,
  Settings2,
  Volume2,
  Shield,
  Zap,
  Plus,
  Footprints,
  ChevronRight,
  Maximize,
  Target,
  Check,
  ArrowRight,
  Move,
  MousePointer2,
  Trophy,
  MapPin,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Slider,
  Switch,
  RadioGroup,
  RadioGroupItem
} from './controls';
import {
  roads,
  buildings,
  START,
  ORIGIN,
  EXTRACTION,
  ATTRIBUTION
} from './shared/layout.mjs';
import { GameEngine, type Snapshot } from './engine';
import {
  WEAPONS,
  clamp,
  type WeaponId,
  type Difficulty,
  type Settings
} from './core';
import './styles.css';
const initial: Snapshot = {
  phase: 'menu',
  health: 100,
  maxHealth: 100,
  ammo: 30,
  reserve: 150,
  kills: 0,
  wave: 1,
  remaining: 0,
  score: 0,
  time: 0,
  fps: 60,
  reload: 0,
  aim: false,
  crouch: false,
  heading: 0,
  extract: false,
  extraction: 0,
  distance: 47,
  hit: 0,
  hurt: 0,
  message: '',
  messageKind: '',
  medkits: 1,
  weapon: 'ar',
  shots: 0,
  hits: 0,
  x: 0,
  z: 18,
  enemies: [],
  quality: 1,
  ready: false,
  best: 0,
  compatibility: false
};
const clock = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
export function Game({
  mode = 'ai',
  initialWeapon = 'ar',
  initialDifficulty = 'recruit',
  onExit,
  onEngine
}: {
  mode?: 'ai' | 'online';
  initialWeapon?: WeaponId;
  initialDifficulty?: Difficulty;
  onExit: () => void;
  onEngine?: (game: GameEngine) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    surface = useRef<HTMLDivElement>(null),
    engine = useRef<GameEngine | null>(null);
  const [state, setState] = useState(initial),
    [error, setError] = useState(''),
    [weapon, setWeapon] = useState<WeaponId>(initialWeapon),
    [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty),
    [settingsOpen, setSettingsOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [settings, setSettings] = useState<Settings>({
      sensitivity: 1,
      volume: 0.55,
      assist: true,
      quality: 'auto'
    });
  useEffect(() => {
    if (!canvas.current || !surface.current) return;
    let game: GameEngine | undefined;
    try {
      game = new GameEngine(
        canvas.current,
        surface.current,
        setState,
        setError
      );
      engine.current = game;
      setSettings(game.settings);
      if (mode === 'ai') game.start(initialWeapon, initialDifficulty);
      onEngine?.(game);
    } catch (e) {
      setError(
        e instanceof Error && /webgl/i.test(e.message)
          ? 'This browser could not start 3D graphics. Open the game in Safari or Chrome and try again.'
          : 'The game could not start. Reload to try again.'
      );
    }
    return () => {
      game?.dispose();
      engine.current = null;
    };
  }, [mode, initialWeapon, initialDifficulty, onEngine]);
  const playing = state.phase === 'playing',
    hud = state.phase !== 'menu',
    ended = state.phase === 'won' || state.phase === 'lost';
  function configure(next: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...next }));
    engine.current?.setSettings(next);
  }
  function openSettings() {
    engine.current?.pause();
    setSettingsOpen(true);
  }
  function fullScreen() {
    const el = document.documentElement;
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }
  return (
    <div
      className={`bw-scope game-root phase-${state.phase}`}
      data-game-phase={state.phase}
    >
      <div className="scene-stage">
        <canvas ref={canvas} aria-label="Tirana Streets first-person combat scene" />
      </div>
      <div
        ref={surface}
        className={`look-surface ${playing ? 'enabled' : ''}`}
        aria-label="Drag to look around"
      />
      <div className="scene-grade" />
      <div className="vignette" />
      {playing && state.hurt > 0 ? (
        <div
          className="damage-overlay"
          style={{ opacity: state.hurt * 0.65 }}
        />
      ) : null}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            T<span>/</span>S
          </span>
          <span className="brand-name">
            TIRANA STREETS
            <small>
              {state.z + ORIGIN.z < 100 ? 'SHESHI SKËNDERBEJ' : state.z + ORIGIN.z > 730 ? 'BLLOKU' : 'TIRANA · LANA'}
            </small>
          </span>
        </div>
        <div className="top-actions">
          <span className="fps-readout">
            {state.ready ? state.fps : '—'} <small>FPS</small>
          </span>
          <button
            className="icon-btn fullscreen"
            onClick={fullScreen}
            title="Fullscreen"
            aria-label="Toggle fullscreen"
          >
            <Maximize size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={openSettings}
            aria-label="Game settings"
          >
            <Settings2 size={19} />
          </button>
          {playing ? (
            <button
              className="icon-btn"
              onClick={() => engine.current?.pause()}
              aria-label="Pause game"
            >
              <Pause size={20} />
            </button>
          ) : null}
        </div>
      </header>
      {state.phase === 'menu' && mode === 'ai' ? (
        <div className="menu-layer">
          <div className="menu-title">
            <div className="eyebrow">
              <span className="tiny-rule" /> OPERATION 01
            </div>
            <h1>
              NO WAY
              <br />
              BUT <em>THROUGH.</em>
            </h1>
            <p>
              Tirana streets. Three waves.
              <br />
              One way out.
            </p>
          </div>
          <div className="location-stamp">
            <span>SECTOR 09</span>
            <strong>TIRANA / BLLOKU</strong>
            <span>17:42 / RAINFALL</span>
          </div>
          <div className="menu-bottom">
            <div className="mission-bar">
              <span>
                <Shield size={15} /> SOLO SURVIVAL
              </span>
              <span>
                3 WAVES <i /> EXTRACTION
              </span>
            </div>
            <div className="loadout-label">
              CHOOSE YOUR LOADOUT <span>01 / 02</span>
            </div>
            <RadioGroup
              value={weapon}
              onValueChange={(v) => setWeapon(v as WeaponId)}
              className="loadout-options"
              aria-label="Weapon loadout"
            >
              <label
                className={`loadout-card ${weapon === 'ar' ? 'selected' : ''}`}
              >
                <RadioGroupItem value="ar" aria-label="MK18 assault rifle" />
                <div>
                  <strong>MK18</strong>
                  <small>CONTROL & PRECISION</small>
                </div>
                <Crosshair size={25} />
              </label>
              <label
                className={`loadout-card ${weapon === 'smg' ? 'selected' : ''}`}
              >
                <RadioGroupItem value="smg" aria-label="MP9 submachine gun" />
                <div>
                  <strong>MP9</strong>
                  <small>SPEED & MOBILITY</small>
                </div>
                <Zap size={25} />
              </label>
            </RadioGroup>
            <RadioGroup
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as Difficulty)}
              className="difficulty-options"
              aria-label="Difficulty"
            >
              <span>DIFFICULTY</span>
              <label>
                <RadioGroupItem value="recruit" />
                Recruit
              </label>
              <label>
                <RadioGroupItem value="veteran" />
                Veteran
              </label>
            </RadioGroup>
            <button
              className="deploy-btn"
              disabled={!state.ready || !!error}
              onClick={() => engine.current?.start(weapon, difficulty)}
            >
              <span>
                {state.ready
                  ? 'DEPLOY TO TIRANA / BLLOKU'
                  : 'PREPARING OPERATION'}
              </span>
              <ArrowUpRight size={24} />
            </button>
            <div className="menu-footer">
              <button onClick={() => setHelpOpen(true)}>
                <Crosshair size={14} /> How to play
              </button>
              <span>
                {state.compatibility
                  ? 'COMPATIBILITY MODE'
                  : state.best > 0
                    ? `BEST ${state.best.toLocaleString()}`
                    : 'HEADPHONES RECOMMENDED'}
              </span>
            </div>
          </div>
          <div className="desktop-note">
            <span>LOCAL SINGLE PLAYER</span>
            <p>
              A quiet street.
              <br />
              An unforgiving exit.
            </p>
          </div>
        </div>
      ) : null}
      {hud ? (
        <div
          className="hud-layer"
          aria-label="Combat status"
          data-shots={state.shots}
          data-hits={state.hits}
          data-position-x={state.x.toFixed(2)}
          data-position-z={state.z.toFixed(2)}
        >
          <div className="compass">
            <span>
              {['N', 'E', 'S', 'W'][Math.round(state.heading / 90) % 4]}
            </span>
            <div className="compass-marks">
              ╵ ┊ ╵ ┊ <b>{state.heading.toString().padStart(3, '0')}</b> ┊ ╵ ┊ ╵
            </div>
            <small>▼</small>
          </div>
          <div className="mission-status">
            {state.online ? (
              <>
                <div className="mission-kicker">TPG DEATHMATCH</div>
                <div className="wave-number">
                  <b>{state.kills}</b>
                  <span>/ {state.online.killLimit} KILLS</span>
                </div>
                <p>
                  {clock(
                    Math.max(
                      0,
                      Math.ceil(state.online.limit - state.online.elapsed)
                    )
                  )}{' '}
                  LEFT · {state.online.players.length} OPERATORS
                </p>
              </>
            ) : (
              <>
                <div className="mission-kicker">
                  {state.extract ? 'EXTRACTION OPEN' : 'SECURE THE BLOCK'}
                </div>
                <div className="wave-number">
                  {state.extract ? (
                    <>
                      <MapPin size={21} />
                      {state.distance}
                      <span>METERS</span>
                    </>
                  ) : (
                    <>
                      WAVE <b>0{state.wave}</b>
                      <span>/ 03</span>
                    </>
                  )}
                </div>
                <p>
                  {state.extract ? (
                    'Reach the green ring at extraction point'
                  ) : (
                    <>
                      <span className="enemy-dot" />
                      {state.remaining} HOSTILES REMAINING
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <MiniMap state={state} />
          {playing ? (
            <>
              <div
                className={`crosshair ${state.aim ? 'aimed' : ''} ${state.hit > 0 ? 'hit' : ''} ${state.hit > 1 ? 'headshot' : ''}`}
              >
                <i />
                <i />
                <i />
                <i />
                <b />
              </div>
              {state.message ? (
                <div
                  className={`combat-message ${state.messageKind}`}
                  key={state.message}
                >
                  {state.messageKind === 'head' ? (
                    <Crosshair size={17} />
                  ) : null}
                  {state.message}
                </div>
              ) : null}
              {state.reload > 0 ? (
                <div className="reload-hint">
                  <RotateCw size={15} />
                  <span>RELOADING</span>
                  <b>{state.reload.toFixed(1)}s</b>
                </div>
              ) : null}
              {state.extract ? (
                <div className="extract-status">
                  <span>
                    {state.distance <= 3
                      ? 'HOLD POSITION'
                      : 'MOVE TO EXTRACTION'}
                  </span>
                  <div
                    style={
                      {
                        '--fill': `${(state.extraction / 5) * 100}%`
                      } as React.CSSProperties
                    }
                  >
                    <i />
                  </div>
                  {state.extraction > 0 ? (
                    <small>
                      {Math.max(0, 5 - state.extraction).toFixed(1)}s
                    </small>
                  ) : null}
                </div>
              ) : null}
              <div className="health-panel">
                <div>
                  <Plus size={18} />
                  <strong>{state.health}</strong>
                  <span>/ {state.maxHealth}</span>
                </div>
                <div className="health-bar">
                  <i
                    style={{
                      width: `${(state.health / state.maxHealth) * 100}%`,
                      background: state.health < 30 ? '#ed7560' : undefined
                    }}
                  />
                </div>
                <small>{state.health < 30 ? 'FIND COVER' : 'VITALS'}</small>
              </div>
              <div className="ammo-panel">
                <span>
                  {WEAPONS[state.weapon].name} <i /> AUTO
                </span>
                <div>
                  <strong className={state.ammo < 6 ? 'low' : ''}>
                    {state.ammo.toString().padStart(2, '0')}
                  </strong>
                  <span>/ {state.reserve}</span>
                </div>
                <small>
                  {state.reload > 0 ? 'RELOADING' : WEAPONS[state.weapon].role}
                </small>
              </div>
              <div className="touch-controls">
                <Joystick engine={engine.current} />
                <div className="right-controls">
                  <LookFire engine={engine.current} />
                  <button
                    className={`touch-btn ads ${state.aim ? 'active' : ''}`}
                    onClick={() => engine.current?.toggleAim()}
                    aria-label="Aim down sights"
                    aria-pressed={state.aim}
                  >
                    <Focus size={23} />
                    <span>AIM</span>
                  </button>
                  <button
                    className="touch-btn reload"
                    onClick={() => engine.current?.reload()}
                    aria-label="Reload weapon"
                  >
                    <RotateCw size={22} />
                    <span>RELOAD</span>
                  </button>
                  <button
                    className={`touch-btn crouch ${state.crouch ? 'active' : ''}`}
                    onClick={() => engine.current?.toggleCrouch()}
                    aria-label="Toggle crouch"
                    aria-pressed={state.crouch}
                  >
                    <Footprints size={22} />
                    <span>LOW</span>
                  </button>
                </div>
              </div>
              <button
                className="medkit-btn"
                disabled={!state.medkits || state.health >= state.maxHealth}
                onClick={() => engine.current?.heal()}
                aria-label="Use medkit"
              >
                <Plus size={20} />
                <span>{state.medkits}</span>
              </button>
              <div className="desktop-controls">
                <span>
                  <kbd>W A S D</kbd> MOVE
                </span>
                <span>DRAG TO LOOK · HOLD TO FIRE</span>
                <span>
                  <kbd>Q</kbd> AIM
                </span>
                <span>
                  <kbd>R</kbd> RELOAD
                </span>
                <span>
                  <kbd>C</kbd> CROUCH
                </span>
                <span>
                  <kbd>E</kbd> HEAL
                </span>
                <button onClick={() => engine.current?.input.lock()}>
                  LOCK MOUSE <MousePointer2 size={12} />
                </button>
              </div>
              {state.time < 9 ? (
                <div className="touch-tip">
                  <Move size={14} />
                  <span>Left thumb moves · Drag right to aim</span>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="match-footer">
            <span>{clock(state.time)}</span>
            <span>{state.kills.toString().padStart(2, '0')} ELIMINATIONS</span>
            <span>{state.score.toLocaleString()} PTS</span>
          </div>
        </div>
      ) : null}
      {state.phase === 'paused' && !settingsOpen ? (
        <div className="intermission">
          <div className="intermission-card">
            <span className="eyebrow">OPERATION ON HOLD</span>
            <h2>TAKE A BREATH.</h2>
            <p>
              {mode === 'online'
                ? 'The online match continues while this menu is open.'
                : 'Your operation is paused.'}
            </p>
            <button
              className="deploy-btn"
              onClick={() => engine.current?.resume()}
            >
              <span>RESUME OPERATION</span>
              <Play size={21} />
            </button>
            <button
              className="secondary-btn"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={17} /> Settings
            </button>
            <button className="text-btn" onClick={onExit}>
              {mode === 'online' ? 'Leave match (forfeit)' : 'Return to lobby'}
            </button>
          </div>
        </div>
      ) : null}
      {state.phase === 'upgrade' ? (
        <div className="intermission">
          <div className="intermission-card upgrade-card">
            <span className="eyebrow">WAVE 0{state.wave} COMPLETE</span>
            <h2>
              REARM.
              <br />
              <em>GO AGAIN.</em>
            </h2>
            <p>
              Health and ammunition restored.
              <br />
              Choose an upgrade for the next wave.
            </p>
            <div className="upgrade-options">
              <button onClick={() => engine.current?.upgrade('damage')}>
                <Crosshair />
                <div>
                  <strong>STOPPING POWER</strong>
                  <span>Deal 25% more damage</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <button onClick={() => engine.current?.upgrade('armor')}>
                <Shield />
                <div>
                  <strong>REINFORCED VEST</strong>
                  <span>+30 health · 15% less damage taken</span>
                </div>
                <ChevronRight size={18} />
              </button>
              <button onClick={() => engine.current?.upgrade('reload')}>
                <Zap />
                <div>
                  <strong>FAST HANDS</strong>
                  <span>Reload 28% faster</span>
                </div>
                <ChevronRight size={18} />
              </button>
            </div>
            <span className="muted-caption">
              UPGRADES LAST UNTIL THIS OPERATION ENDS
            </span>
          </div>
        </div>
      ) : null}
      {ended ? (
        <div className="intermission">
          <div className="intermission-card results-card">
            <span className="eyebrow">
              {state.online && !state.online.winnerAccountId
                ? 'STAKES REFUNDED'
                : state.phase === 'won'
                  ? 'OPERATION COMPLETE'
                  : 'OPERATION FAILED'}
            </span>
            {state.phase === 'won' ? (
              <Trophy className="result-icon" />
            ) : (
              <X className="result-icon" />
            )}
            <h2>
              {state.online && !state.online.winnerAccountId
                ? 'MATCH CLOSED.'
                : state.phase === 'won'
                  ? 'YOU MADE IT.'
                  : 'NOT THIS TIME.'}
            </h2>
            <p>
              {state.online
                ? state.online.winnerAccountId
                  ? 'The match result is confirmed.'
                  : 'Match drawn or cancelled. Stakes are refunded.'
                : state.phase === 'won'
                  ? 'Tirana is clear. Extraction confirmed.'
                  : 'Find cover. Control your shots. Go again.'}
            </p>
            <div className="result-score">
              {state.score.toLocaleString()}
              <span>OPERATION SCORE</span>
            </div>
            <div className="result-stats">
              <div>
                <strong>{state.kills}</strong>
                <span>ELIMINATIONS</span>
              </div>
              <div>
                <strong>
                  {state.shots
                    ? Math.round((state.hits / state.shots) * 100)
                    : 0}
                  %
                </strong>
                <span>ACCURACY</span>
              </div>
              <div>
                <strong>{clock(state.time)}</strong>
                <span>TIME</span>
              </div>
            </div>
            {state.online ? (
              <p className="bw-settlement" role="status">
                {state.online.settlement?.status === 'pending'
                  ? 'TPG settlement pending…'
                  : state.online.settlement?.status === 'paid'
                    ? `${state.online.stake * state.online.players.length} TPG awarded to the winner.`
                    : state.online.settlement?.status === 'refunded'
                      ? `${state.online.stake} TPG refunded to each player.`
                      : 'Confirming TPG settlement…'}
              </p>
            ) : (
              <button
                className="deploy-btn"
                onClick={() => engine.current?.start(weapon, difficulty)}
              >
                <span>DEPLOY AGAIN</span>
                <RotateCw size={21} />
              </button>
            )}
            <button className="text-btn" onClick={onExit}>
              Return to lobby
            </button>
          </div>
        </div>
      ) : null}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="game-dialog">
          <DialogTitle className="dialog-title">FIELD SETTINGS</DialogTitle>
          <DialogDescription>
            Make the controls feel right for you.
          </DialogDescription>
          <div className="settings-fields">
            <label className="slider-field">
              <span>
                Look sensitivity <b>{settings.sensitivity.toFixed(2)}×</b>
              </span>
              <Slider
                aria-label="Look sensitivity"
                value={[settings.sensitivity]}
                onValueChange={(v) => configure({ sensitivity: v[0] })}
                min={0.35}
                max={2}
                step={0.05}
              />
            </label>
            <label className="slider-field">
              <span>
                <Volume2 size={16} /> Sound{' '}
                <b>{Math.round(settings.volume * 100)}%</b>
              </span>
              <Slider
                aria-label="Sound volume"
                value={[settings.volume]}
                onValueChange={(v) => configure({ volume: v[0] })}
                min={0}
                max={1}
                step={0.05}
              />
            </label>
            <label className="switch-field">
              <div>
                <strong>Aim assist</strong>
                <small>Gentle guidance near visible targets.</small>
              </div>
              <Switch
                checked={settings.assist}
                onCheckedChange={(v) => configure({ assist: v })}
                aria-label="Aim assist"
              />
            </label>
            <div className="quality-field">
              <span>Graphics</span>
              <RadioGroup
                value={settings.quality}
                onValueChange={(v) =>
                  configure({ quality: v as Settings['quality'] })
                }
                className="quality-options"
                aria-label="Graphics quality"
              >
                {(['auto', 'high', 'low'] as const).map((q) => (
                  <label key={q}>
                    <RadioGroupItem value={q} />
                    {q === 'auto'
                      ? 'Adaptive'
                      : q === 'high'
                        ? 'High'
                        : 'Battery'}
                  </label>
                ))}
              </RadioGroup>
              <small>
                {state.compatibility
                  ? 'Compatibility mode is active: lower detail because 3D acceleration is unavailable in this browser.'
                  : 'Adaptive adjusts resolution to keep movement smooth.'}
              </small>
            </div>
          </div>
          <button
            className="deploy-btn"
            onClick={() => {
              setSettingsOpen(false);
              if (state.phase === 'paused') engine.current?.resume();
            }}
          >
            <span>{state.phase === 'paused' ? 'SAVE & RESUME' : 'DONE'}</span>
            <Check size={20} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="game-dialog">
          <DialogTitle className="dialog-title">GET IN. GET OUT.</DialogTitle>
          <DialogDescription>Your first operation in Tirana.</DialogDescription>
          <ol className="briefing-list">
            <li>
              <span>01</span>
              <div>
                <strong>Clear the street</strong>
                <p>
                  Eliminate every hostile. Red marks on the map show their
                  positions.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Build your advantage</strong>
                <p>
                  Pick an upgrade after each wave. Your health and ammunition
                  refill.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Reach extraction</strong>
                <p>
                  After wave 3, move to the green ring at extraction point. Hold
                  for 5 seconds.
                </p>
              </div>
            </li>
          </ol>
          <div className="help-controls">
            <p>
              <b>On your phone</b> Move with the left stick. Drag on the right
              to look. Hold and drag FIRE to shoot and aim together.
            </p>
            <p>
              <b>On a computer</b> WASD to move. Drag to look; hold to fire. Q
              to aim, R to reload, C to crouch, E to heal. Arrow keys also aim;
              F fires.
            </p>
          </div>
          <button className="deploy-btn" onClick={() => setHelpOpen(false)}>
            <span>UNDERSTOOD</span>
            <ArrowRight size={20} />
          </button>
        </DialogContent>
      </Dialog>
      <a
        className="bw-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        {ATTRIBUTION}
      </a>
      {error ? (
        <div className="intermission">
          <div className="intermission-card">
            <span className="eyebrow">CONNECTION INTERRUPTED</span>
            <h2>LET’S TRY AGAIN.</h2>
            <p>{error}</p>
            <button
              className="deploy-btn"
              onClick={() => window.location.reload()}
            >
              <span>RELOAD GAME</span>
              <RotateCw size={20} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const MiniMap = memo(function MiniMap({ state }: { state: Snapshot }) {
  const size = 120,
    minX = state.x - size / 2,
    minZ = state.z - size / 2,
    x = (v: number) => ((v - minX) / size) * 100,
    z = (v: number) => ((v - minZ) / size) * 100;
  const localRoads = roads.filter(
    (r) =>
      Math.min(r.a[0], r.b[0]) < minX + size &&
      Math.max(r.a[0], r.b[0]) > minX &&
      Math.min(r.a[1], r.b[1]) < minZ + size &&
      Math.max(r.a[1], r.b[1]) > minZ
  );
  return (
    <div className="minimap">
      <div className="map-north">N</div>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Tirana tactical map, north up"
      >
        <rect width="100" height="100" fill="#16292c" />
        {localRoads
          .filter((r) => !r.walk)
          .map((r) => (
            <path
              key={r.id}
              d={`M${x(r.a[0])} ${z(r.a[1])}L${x(r.b[0])} ${z(r.b[1])}`}
              stroke="#6d8280"
              strokeWidth={(r.w / size) * 100}
              opacity=".45"
            />
          ))}
        {buildings
          .filter(
            (b) =>
              Math.abs(b.x - state.x) < size * 0.6 &&
              Math.abs(b.z - state.z) < size * 0.6
          )
          .map((b) => (
            <polygon
              key={b.id}
              points={b.footprint.map(p => `${x(p[0])},${z(p[1])}`).join(' ')}
              fill="#7b8c84"
            />
          ))}
        {state.extract ? (
          <circle
            cx={x(EXTRACTION.x)}
            cy={z(EXTRACTION.z)}
            r="4"
            fill="none"
            stroke="#a3e3b8"
          />
        ) : null}
        {state.enemies
          .filter((e) => e.alive)
          .map((e, i) => (
            <circle key={i} cx={x(e.x)} cy={z(e.z)} r="2" fill="#f09470" />
          ))}
        <g transform={`translate(50,50) rotate(${state.heading})`}>
          <path d="M0 -5L3.5 4L0 2L-3.5 4Z" fill="#ecf8ef" />
        </g>
      </svg>
      <span>TIRANA / BLLOKU</span>
    </div>
  );
});
function Joystick({ engine }: { engine: GameEngine | null }) {
  const knob = useRef<HTMLSpanElement>(null),
    active = useRef<number | null>(null),
    center = useRef({ x: 0, y: 0 });
  function move(e: ReactPointer<HTMLDivElement>) {
    if (active.current !== e.pointerId) return;
    const dx = e.clientX - center.current.x,
      dy = e.clientY - center.current.y,
      d = Math.hypot(dx, dy),
      r = 42;
    const x = dx / Math.max(r, d),
      y = dy / Math.max(r, d);
    if (engine) engine.input.move = { x, y };
    if (knob.current)
      knob.current.style.transform = `translate(${x * r}px,${y * r}px)`;
  }
  function end() {
    active.current = null;
    if (engine) engine.input.move = { x: 0, y: 0 };
    if (knob.current) knob.current.style.transform = 'translate(0,0)';
  }
  useEffect(() => end, [engine]);
  return (
    <div
      className="joystick"
      role="group"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div className="stick-ring">
        <span ref={knob}>
          <Move size={23} />
        </span>
      </div>
      <small>MOVE / SPRINT</small>
    </div>
  );
}
function LookFire({ engine }: { engine: GameEngine | null }) {
  const active = useRef<number | null>(null),
    last = useRef({ x: 0, y: 0 });
  function stop() {
    active.current = null;
    if (engine) engine.input.firing = false;
  }
  useEffect(() => stop, [engine]);
  return (
    <button
      className="fire-btn"
      aria-label="Hold to fire; drag to aim"
      onPointerDown={(e) => {
        e.preventDefault();
        active.current = e.pointerId;
        last.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        engine?.beginFire();
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) {
          engine?.look(e.clientX - last.current.x, e.clientY - last.current.y);
          last.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <Crosshair size={31} />
      <span>FIRE</span>
    </button>
  );
}
