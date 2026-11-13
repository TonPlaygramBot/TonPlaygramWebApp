import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Flag,
  Globe,
  Users,
  Trophy,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Camera,
  RotateCcw,
  Settings2,
  Waves,
  Zap,
  Check,
  Copy
} from 'lucide-react';
import Scene, { type World } from './Scene';
import Controls from './Controls';
import { JetskiAudio } from './audio';
import { type Quality, type CameraMode } from './renderer';
import {
  request,
  loadSession,
  saveSession,
  type Room,
  type Session,
  type Services
} from './network';
import {
  TRACKS,
  CRAFTS,
  STEP,
  RACE_LIMIT,
  makeTrack,
  createRacer,
  neutralInput,
  stepRace,
  standings,
  formatTime,
  type Racer,
  type Input
} from './simulation.mjs';
import './jetski.css';

type Mode = 'ai' | 'time' | 'online';
const COLORS = [
  '#32e2d1',
  '#ffab62',
  '#c6b4ff',
  '#f2e477',
  '#64aeff',
  '#ff779b'
];
const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export default function JetskiGame({
  services,
  onExit,
  preview = false
}: {
  services?: Services;
  onExit?: () => void;
  preview?: boolean;
}) {
  const [trackId, setTrackId] = useState('ksamil'),
    [craftId, setCraftId] = useState('pulse'),
    [mode, setMode] = useState<Mode>('ai');
  const [difficulty, setDifficulty] = useState('club'),
    [day, setDay] = useState<'day' | 'sunset'>('day');
  const [quality, setQuality] = useState<Quality>(() => {
    const q = read('jetski.quality', 'auto');
    return ['auto', 'high', 'balanced', 'battery'].includes(q)
      ? (q as Quality)
      : 'auto';
  });
  const [name, setName] = useState(() => read('jetski.name', 'Rider')),
    [sound, setSound] = useState(() => read('jetski.sound', 'on') !== 'off');
  const [phase, setPhase] = useState<
    'lobby' | 'loading' | 'countdown' | 'racing' | 'finished'
  >('lobby');
  const [paused, setPaused] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [camera, setCamera] = useState<CameraMode>(() =>
      read('jetski.camera', 'chase') === 'eyes' ? 'eyes' : 'chase'
    );
  const [room, setRoom] = useState<Room | null>(null),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [notice, setNotice] = useState(''),
    [connected, setConnected] = useState(services?.socket.connected ?? false);
  const [hud, setHud] = useState({
    speed: 0,
    boost: 100,
    lap: 1,
    position: 1,
    elapsed: 0,
    countdown: 3,
    gate: 0,
    air: 0,
    penalty: 0,
    ejected: false
  });
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<Racer[]>([]),
    [best, setBest] = useState(() => read('jetski.best.ksamil', ''));
  const track = useMemo(() => makeTrack(trackId), [trackId]);
  const session = useRef<Session | null>(null),
    roomRef = useRef<Room | null>(null),
    phaseRef = useRef(phase),
    pausedRef = useRef(paused);
  const input = useRef<Input>(neutralInput()),
    audio = useRef<JetskiAudio | null>(null),
    clock = useRef(0),
    countdown = useRef(3),
    accumulator = useRef(0),
    hudClock = useRef(0),
    sendClock = useRef(0),
    serverOffset = useRef(0),
    lastState = useRef(0);
  const gates = useRef(0),
    landings = useRef(0),
    crashes = useRef(0),
    count = useRef(0),
    finishSaved = useRef(false),
    resumePending = useRef(false);
  const world = useRef<World>({
    racers: [],
    playerId: 'you',
    elapsed: 0,
    camera: 'chase',
    preview: true,
    paused: false
  });
  phaseRef.current = phase;
  pausedRef.current = paused;
  world.current.camera = camera;
  world.current.paused = paused;
  const isLobby = phase === 'lobby',
    online = mode === 'online';
  const unlock = useCallback(() => {
    if (!audio.current) audio.current = new JetskiAudio();
    void audio.current.unlock();
    audio.current.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    write('jetski.sound', sound ? 'on' : 'off');
    audio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    write('jetski.quality', quality);
  }, [quality]);
  useEffect(() => {
    write('jetski.camera', camera);
  }, [camera]);
  useEffect(() => {
    setBest(read(`jetski.best.${trackId}`, ''));
  }, [trackId]);
  useEffect(() => {
    if (phase !== 'lobby') return;
    world.current = {
      racers: [createRacer(track, 'you', name, 0, false, craftId)],
      playerId: 'you',
      elapsed: 0,
      camera: 'chase',
      preview: true,
      paused: false
    };
  }, [track, craftId, phase, name]);
  const acceptState = useCallback(
    (state: Room) => {
      if (!session.current || state.code !== session.current.code) return;
      roomRef.current = state;
      setRoom((previous) =>
        previous?.status === state.status &&
        previous.hostId === state.hostId &&
        JSON.stringify(previous.players) === JSON.stringify(state.players)
          ? previous
          : state
      );
      lastState.current = performance.now();
      serverOffset.current = state.serverNow - Date.now();
      if (state.trackId !== trackId) setTrackId(state.trackId);
      if (state.status === 'waiting') {
        crashes.current = 0;
        setPhase('lobby');
        return;
      }
      world.current.racers = state.racers;
      world.current.playerId = session.current.playerId;
      world.current.elapsed = state.elapsed;
      world.current.preview = false;
      setPhase(state.status);
      if (state.status === 'finished') {
        setResults(state.results);
        audio.current?.update(0, false, false, false);
      }
    },
    [trackId]
  );
  const acceptRef = useRef(acceptState);
  acceptRef.current = acceptState;
  useEffect(() => {
    if (!services) return;
    const s = services.socket;
    const state = (v: Room) => acceptRef.current(v);
    const closed = (v: { error: string }) => {
      saveSession(null);
      session.current = null;
      roomRef.current = null;
      setRoom(null);
      setPhase('lobby');
      setError(v.error);
    };
    const disconnect = () => {
      setConnected(false);
      input.current = neutralInput();
      if (session.current)
        setNotice('Connection lost. Reconnecting to your race…');
    };
    const resume = async () => {
      setConnected(true);
      const stored = session.current || loadSession();
      if (!stored || resumePending.current) return;
      resumePending.current = true;
      try {
        session.current = stored;
        setMode('online');
        const reply = await request(s, 'resume', stored);
        if (reply.state) acceptRef.current(reply.state);
        setNotice('');
      } catch (e) {
        closed({
          error: e instanceof Error ? e.message : 'Could not resume your race.'
        });
      } finally {
        resumePending.current = false;
      }
    };
    s.on('jetski:state', state);
    s.on('jetski:closed', closed);
    s.on('connect', resume);
    s.on('disconnect', disconnect);
    if (s.connected) void resume();
    return () => {
      s.off('jetski:state', state);
      s.off('jetski:closed', closed);
      s.off('connect', resume);
      s.off('disconnect', disconnect);
      s.emit('jetski:input', neutralInput());
    };
  }, [services]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        input.current = neutralInput();
        audio.current?.update(0, false, false, false);
        if (mode !== 'online' && phaseRef.current !== 'lobby') setPaused(true);
        services?.socket.emit('jetski:input', neutralInput());
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [mode, services]);
  useEffect(() => () => audio.current?.close(), []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong. Please retry.'
      );
    } finally {
      setBusy(false);
    }
  };
  const join = (event: string) =>
    void run(async () => {
      if (!services)
        throw Error(
          'Online rooms are available inside TonPlayGram after this update is deployed. You can race AI here.'
        );
      await services.authorize();
      unlock();
      write('jetski.name', name);
      const reply = await request(services.socket, event, {
        trackId,
        craftId,
        name,
        code
      });
      session.current = {
        code: reply.code!,
        playerId: reply.playerId!,
        token: reply.token!
      };
      saveSession(session.current);
      setNotice('');
      if (reply.state) acceptState(reply.state);
    });
  const roomAction = (event: string, data: object = {}) =>
    void run(async () => {
      if (!services) return;
      unlock();
      const reply = await request(services.socket, event, data);
      if (reply.state) acceptState(reply.state);
    });
  const leave = async () => {
    input.current = neutralInput();
    audio.current?.update(0, false, false, false);
    if (session.current && services) {
      try {
        await request(services.socket, 'leave');
      } catch {}
    }
    saveSession(null);
    session.current = null;
    roomRef.current = null;
    setRoom(null);
    setPhase('lobby');
    setPaused(false);
    setNotice('');
    world.current.preview = true;
  };
  const startAI = () => {
    setAttempt((v) => v + 1);
    unlock();
    write('jetski.name', name);
    setError('');
    setNotice('');
    setResults([]);
    setPaused(false);
    finishSaved.current = false;
    const racers = [
      createRacer(track, 'you', name || 'You', 0, false, craftId)
    ];
    if (mode === 'ai')
      for (let i = 1; i < 6; i++)
        racers.push(
          createRacer(
            track,
            `ai-${i}`,
            ['', 'Luan', 'Nora', 'Drin', 'Bora', 'Ilir'][i],
            i,
            true,
            CRAFTS[i % 3].id
          )
        );
    clock.current = 0;
    accumulator.current = 0;
    countdown.current = 3;
    hudClock.current = 0;
    gates.current = 0;
    landings.current = 0;
    crashes.current = 0;
    count.current = 0;
    world.current = {
      racers,
      playerId: 'you',
      elapsed: 0,
      camera,
      preview: false,
      paused: false
    };
    setPhase('loading');
  };
  const loaded = useCallback(() => {
    if (phaseRef.current === 'loading') setPhase('countdown');
  }, []);
  const finish = () => {
    const ranked = standings(world.current.racers);
    setResults(ranked);
    setPhase('finished');
    audio.current?.cue('finish');
    const me = ranked.find((v) => v.id === 'you');
    if (me?.finished && !finishSaved.current) {
      finishSaved.current = true;
      const key = `jetski.best.${trackId}`,
        old = Number(read(key, '0'));
      if (!old || me.finishTime < old) {
        write(key, String(me.finishTime));
        setBest(String(me.finishTime));
      }
    }
  };
  const onFrame = (dt: number) => {
    const current = phaseRef.current,
      w = world.current;
    if (current === 'lobby') return;
    if (online) {
      const state = roomRef.current;
      if (!state) return;
      w.elapsed = state.elapsed;
      countdown.current = Math.max(
        0,
        (state.startsAt - Date.now() - serverOffset.current) / 1000
      );
      sendClock.current += dt;
      if (sendClock.current >= 1 / 30 && services?.socket.connected) {
        sendClock.current = 0;
        services.socket.volatile.emit(
          'jetski:input',
          pausedRef.current ? neutralInput() : input.current
        );
      }
      // Authoritative snapshots are rendered with smoothing; do not advance remote race results locally.
    } else if (!pausedRef.current) {
      if (current === 'countdown') {
        countdown.current -= dt;
        const next = Math.ceil(countdown.current);
        if (next !== count.current) {
          count.current = next;
          audio.current?.cue('count');
        }
        if (countdown.current <= 0) setPhase('racing');
      }
      if (current === 'racing') {
        accumulator.current += dt;
        while (accumulator.current >= STEP) {
          clock.current += STEP;
          w.racers[0].input = { ...input.current };
          stepRace(w.racers, track, STEP, clock.current, difficulty);
          accumulator.current -= STEP;
        }
        w.elapsed = clock.current;
        if (w.racers[0].finished || clock.current >= RACE_LIMIT) finish();
      }
    }
    const me = w.racers.find((v) => v.id === w.playerId);
    if (!me) return;
    if (me.gatesPassed > gates.current) {
      gates.current = me.gatesPassed;
      audio.current?.cue('gate');
    }
    if (me.landings > landings.current) {
      landings.current = me.landings;
      audio.current?.cue('splash');
    }
    if (me.crashes > crashes.current) audio.current?.cue('crash');
    crashes.current = me.crashes;
    const active =
      current === 'racing' &&
      !me.crash &&
      !pausedRef.current &&
      (!online || (connected && performance.now() - lastState.current < 1500));
    audio.current?.update(
      me.speed,
      input.current.throttle,
      me.boosting,
      active
    );
    hudClock.current += dt;
    if (hudClock.current > 0.09) {
      hudClock.current = 0;
      setHud({
        speed: me.speed * 3.6,
        boost: me.boost,
        lap: Math.max(1, Math.min(me.lap, track.laps)),
        position: standings(w.racers).findIndex((v) => v.id === me.id) + 1,
        elapsed: w.elapsed,
        countdown: Math.max(0, Math.ceil(countdown.current)),
        gate: me.nextGate,
        air: me.airborne ? me.jumpDistance : 0,
        penalty: me.penalty,
        ejected: Boolean(me.crash)
      });
    }
  };
  const scene = (
    <Scene
      key={`${isLobby ? 'showroom' : 'race'}-${trackId}-${attempt}`}
      track={track}
      quality={quality}
      day={day}
      world={world}
      onReady={loaded}
      onFrame={onFrame}
    />
  );
  const settings = (
    <div className="jsr-settings-fields">
      <label>
        Graphics
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as Quality)}
        >
          <option value="auto">Auto · adaptive resolution</option>
          <option value="high">High detail</option>
          <option value="balanced">Balanced</option>
          <option value="battery">Battery saver</option>
        </select>
      </label>
      <label>
        Light
        <select
          value={day}
          onChange={(e) => setDay(e.target.value as 'day' | 'sunset')}
        >
          <option value="day">Daylight</option>
          <option value="sunset">Golden hour</option>
        </select>
      </label>
      <button className="jsr-secondary" onClick={() => setSound((v) => !v)}>
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />} Sound{' '}
        {sound ? 'on' : 'off'}
      </button>
    </div>
  );
  const myPlayer = room?.players.find(
      (v) => v.id === session.current?.playerId
    ),
    host = room?.hostId === session.current?.playerId;

  if (isLobby)
    return (
      <main className="jsr jsr-lobby">
        <header className="jsr-topbar">
          <button
            aria-label="Back to games"
            className="jsr-icon-button"
            onClick={() => {
              void leave().then(() => onExit?.());
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <span>
            TONPLAYGRAM <b>/</b> RACING
          </span>
          <button
            aria-label="Open settings"
            className="jsr-icon-button"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings2 size={20} />
          </button>
        </header>
        <section className="jsr-hero">
          {scene}
          <div className="jsr-hero-shade" />
          <div className="jsr-hero-copy">
            <span className="jsr-eyebrow">
              <span /> ADRIATIC SERIES 01
            </span>
            <h1>
              JET SKI
              <br />
              <em>ROYAL.</em>
            </h1>
            <p>Find your line. Own the water.</p>
          </div>
          <span className="jsr-hero-tag">
            <Waves size={15} /> {day === 'day' ? 'DAYLIGHT' : 'GOLDEN HOUR'}
          </span>
          {track.pointToPoint && <MapAttribution />}
        </section>
        <div className="jsr-lobby-content">
          <div className="jsr-section-title">
            <div>
              <span className="jsr-eyebrow">YOUR NEXT RACE</span>
              <h2>Make waves.</h2>
            </div>
            <span className="jsr-pill">
              <Flag size={13} />{' '}
              {track.pointToPoint ? 'River sprint' : `${track.laps} laps`}
            </span>
          </div>
          {showSettings && (
            <section className="jsr-panel">
              {settings}
              <p className="jsr-note">
                Left and right steer. Hold throttle to move; brake before tight
                corners. Boost recharges and green rings refill it.
              </p>
            </section>
          )}
          {!room && (
            <>
              <div className="jsr-modes" role="group" aria-label="Race mode">
                {(
                  [
                    { id: 'ai', icon: Users, title: 'VS AI', sub: '6 riders' },
                    {
                      id: 'online',
                      icon: Globe,
                      title: 'Online',
                      sub: 'Race friends'
                    },
                    {
                      id: 'time',
                      icon: Trophy,
                      title: 'Time trial',
                      sub: 'Your best line'
                    }
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    className={mode === item.id ? 'selected' : ''}
                    aria-pressed={mode === item.id}
                    onClick={() => {
                      setMode(item.id);
                      setError('');
                    }}
                  >
                    <item.icon size={20} />
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </button>
                ))}
              </div>
              <section>
                <div className="jsr-section-label">
                  <h3>
                    01 <span>Choose your water</span>
                  </h3>
                  <span>{TRACKS.length} courses</span>
                </div>
                <div className="jsr-tracks">
                  {TRACKS.map((t, i) => (
                    <button
                      className={`jsr-track ${trackId === t.id ? 'selected' : ''}`}
                      onClick={() => setTrackId(t.id)}
                      key={t.id}
                      aria-pressed={trackId === t.id}
                    >
                      <div className={`jsr-track-art jsr-track-art-${i}`}>
                        <MiniMap track={makeTrack(t.id)} />
                        <span>0{i + 1}</span>
                      </div>
                      <div>
                        <strong>{t.name}</strong>
                        <span>
                          {t.difficulty} · {t.length}
                        </span>
                      </div>
                      {trackId === t.id ? (
                        <Check size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="jsr-section-label">
                  <h3>
                    02 <span>Choose your ride</span>
                  </h3>
                  <span>Same hull · tuned handling</span>
                </div>
                <div className="jsr-crafts">
                  {CRAFTS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCraftId(c.id)}
                      className={craftId === c.id ? 'selected' : ''}
                      aria-pressed={craftId === c.id}
                      style={{ '--craft': c.color } as React.CSSProperties}
                    >
                      <i />
                      <strong>{c.name}</strong>
                      <span>{c.role}</span>
                      <div className="jsr-stat">
                        <span style={{ width: `${c.speed * 2.5}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <div className="jsr-options">
                <label>
                  Rider name
                  <input
                    value={name}
                    maxLength={18}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
                {mode === 'ai' ? (
                  <label>
                    AI level
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="rookie">Rookie</option>
                      <option value="club">Club</option>
                      <option value="pro">Pro</option>
                    </select>
                  </label>
                ) : (
                  <div className="jsr-record">
                    <span>Personal best</span>
                    <strong>
                      {best ? formatTime(Number(best)) : 'Set your first time'}
                    </strong>
                  </div>
                )}
              </div>
            </>
          )}
          {online && (
            <section className="jsr-panel jsr-online">
              <div className="jsr-section-title">
                <h3>
                  <Globe size={18} />{' '}
                  {room ? 'Race room' : 'Meet on the starting line'}
                </h3>
                <span className="jsr-pill">Free entry</span>
              </div>
              {room ? (
                <>
                  <div className="jsr-room-code">
                    <span>
                      SHARE THIS CODE<strong>{room.code}</strong>
                    </span>
                    <button
                      className="jsr-icon-button"
                      aria-label="Copy room code"
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(room.code)
                          .then(() => setNotice('Room code copied.'))
                          .catch(() => setNotice(`Share code ${room.code}`))
                      }
                    >
                      <Copy size={20} />
                    </button>
                  </div>
                  <p className="jsr-note">
                    {TRACKS.find((t) => t.id === room.trackId)?.name} ·{' '}
                    {room.players.length}/6 riders · AI fills empty seats
                  </p>
                  <div className="jsr-players">
                    {room.players.map((p, i) => (
                      <div key={p.id}>
                        <span
                          className="jsr-avatar"
                          style={{ background: COLORS[i] }}
                        >
                          {p.name.slice(0, 1)}
                        </span>
                        <strong>
                          {p.name}
                          {p.id === session.current?.playerId ? ' · You' : ''}
                        </strong>
                        <span>
                          {!p.connected
                            ? 'Reconnecting'
                            : p.ready
                              ? 'Ready'
                              : 'Not ready'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="jsr-secondary"
                    disabled={busy}
                    onClick={() =>
                      roomAction('ready', { ready: !myPlayer?.ready })
                    }
                  >
                    {myPlayer?.ready ? 'Undo ready' : 'I’m ready'}
                  </button>
                  {host && (
                    <button
                      className="jsr-primary"
                      disabled={
                        busy ||
                        room.players.length < 2 ||
                        room.players.some((p) => !p.ready || !p.connected)
                      }
                      onClick={() => roomAction('start')}
                    >
                      Start online race <ArrowUpRight size={20} />
                    </button>
                  )}
                  {!host && (
                    <p className="jsr-note">
                      The host starts when everyone is ready.
                    </p>
                  )}
                  <button
                    className="jsr-text-button"
                    onClick={() => void leave()}
                  >
                    Leave room
                  </button>
                </>
              ) : (
                <>
                  <p className="jsr-note">
                    Up to 6 riders. Quick match or share a private room code.
                    Ready up together; the host starts the race.
                  </p>
                  {!services && (
                    <p className="jsr-preview-notice">
                      This preview includes AI and time trial. Online rooms run
                      in the main TonPlayGram app after deployment.
                    </p>
                  )}
                  <div className="jsr-two-buttons">
                    <button
                      className="jsr-secondary"
                      disabled={busy}
                      onClick={() => join('quick')}
                    >
                      Quick match
                    </button>
                    <button
                      className="jsr-secondary"
                      disabled={busy}
                      onClick={() => join('create')}
                    >
                      Create room
                    </button>
                  </div>
                  <div className="jsr-join">
                    <input
                      aria-label="Room code"
                      placeholder="6-character code"
                      value={code}
                      maxLength={6}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .replace(/[^a-f0-9]/gi, '')
                            .toUpperCase()
                        )
                      }
                    />
                    <button
                      className="jsr-secondary"
                      disabled={busy || code.length !== 6}
                      onClick={() => join('join')}
                    >
                      Join
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {error && (
            <p className="jsr-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="jsr-notice" role="status">
              {notice}
            </p>
          )}
          {!online && (
            <button className="jsr-primary jsr-launch" onClick={startAI}>
              <span>
                <small>{track.name.toUpperCase()}</small>
                {mode === 'time'
                  ? 'Start time trial'
                  : track.pointToPoint
                    ? 'Race Lana River'
                    : 'Race the coast'}
              </span>
              <ArrowUpRight size={26} />
            </button>
          )}
          <div className="jsr-feature-row">
            <span>
              <Waves size={15} /> Dynamic water
            </span>
            <span>
              <Zap size={15} /> {track.pointToPoint ? 'Boost' : 'Boost & jumps'}
            </span>
            <span>
              <Camera size={15} /> Rider view
            </span>
          </div>
          <p className="jsr-note jsr-bottom-note">
            Hold throttle + steer. Pass every marked gate in order. Green rings
            recharge boost. {!track.pointToPoint && 'Ramps add airtime. '}
            Recovery costs 5 seconds.
          </p>
          <details className="jsr-credits">
            <summary>Asset credits</summary>
            <p>
              Watercraft: Innerscene (CC0). Coast rocks: Poly Haven (CC0).
              Rider: Quaternius Universal Base Characters (CC0). Water normals:
              Three.js examples (MIT). Engine and water audio synthesized in
              real time.
            </p>
            <p>
              Lana River uses Tirana Streets map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL).
            </p>
          </details>
        </div>
      </main>
    );

  const stale =
    online && (!connected || performance.now() - lastState.current > 2000);
  return (
    <main className="jsr jsr-race">
      {scene}
      <div className="jsr-race-top">
        <button
          className="jsr-icon-button"
          aria-label="Pause and settings"
          onClick={() => {
            setPaused(true);
            input.current = neutralInput();
          }}
        >
          <Pause size={19} />
        </button>
        <span>
          JET SKI <b>ROYAL</b>
        </span>
        <button
          className="jsr-icon-button"
          aria-label="Toggle sound"
          onClick={() => {
            unlock();
            setSound((v) => !v);
          }}
        >
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
      <div className="jsr-race-stats">
        <div>
          <span>POSITION</span>
          <strong>
            {hud.position}
            <small>/{world.current.racers.length}</small>
          </strong>
        </div>
        <div>
          <span>{track.pointToPoint ? 'GATE' : 'LAP'}</span>
          <strong>
            {track.pointToPoint ? hud.gate + 1 : hud.lap}
            <small>
              /{track.pointToPoint ? track.gates.length : track.laps}
            </small>
          </strong>
        </div>
        <div>
          <span>RACE TIME</span>
          <strong className="jsr-clock">{formatTime(hud.elapsed)}</strong>
        </div>
      </div>
      <div className="jsr-map">
        <MiniMap
          track={track}
          racers={world.current.racers}
          playerId={world.current.playerId}
        />
        {track.pointToPoint && <MapAttribution />}
      </div>
      <div className="jsr-race-actions">
        <button
          className="jsr-icon-button jsr-camera-toggle"
          aria-label="Rider eye camera"
          aria-pressed={camera === 'eyes'}
          title={
            camera === 'eyes'
              ? 'Switch to chase camera'
              : 'Switch to rider eye camera'
          }
          onClick={() => setCamera((v) => (v === 'chase' ? 'eyes' : 'chase'))}
        >
          <Camera size={16} />
          <span>{camera === 'eyes' ? 'Rider' : 'Chase'}</span>
        </button>
        <button
          className="jsr-icon-button"
          aria-label="Recover to last checkpoint, five second penalty"
          disabled={hud.ejected}
          onClick={() => {
            input.current = { ...input.current, recover: true };
            if (online) services?.socket.emit('jetski:input', input.current);
            window.setTimeout(() => {
              input.current = { ...input.current, recover: false };
            }, 120);
          }}
        >
          <RotateCcw size={19} />
        </button>
      </div>
      {phase === 'countdown' && (
        <div className="jsr-countdown">
          <span>READY ON THE LINE</span>
          <strong>{hud.countdown || 'GO'}</strong>
          <p>Hold throttle. Steer through the buoys.</p>
        </div>
      )}
      {hud.ejected && phase === 'racing' && !paused && (
        <div className="jsr-ejected" role="status">
          <strong>Rider in the water</strong>
          <span>Remounting jet ski…</span>
        </div>
      )}
      {hud.air > 0 && !hud.ejected && (
        <div className="jsr-airtime">
          <span>AIRTIME</span>
          <strong>{hud.air.toFixed(1)} m</strong>
        </div>
      )}
      {phase === 'racing' && !paused && (
        <>
          <div className="jsr-drive-info">
            <span>
              GATE {hud.gate + 1}/{track.gates.length}
              {hud.penalty > 0 ? ` · +${hud.penalty}s` : ''}
            </span>
            <strong>
              {Math.round(hud.speed)}
              <small>km/h</small>
            </strong>
            <div className="jsr-boost-bar">
              <i style={{ width: `${hud.boost}%` }} />
            </div>
            <span>
              <Zap size={12} /> BOOST {Math.round(hud.boost)}%
            </span>
          </div>
          <Controls input={input} onGesture={unlock} />
        </>
      )}
      {stale && phase !== 'finished' && (
        <div className="jsr-network-warning" role="status">
          Reconnecting… Your race continues on the server.
        </div>
      )}
      {paused && phase !== 'finished' && (
        <div className="jsr-modal-backdrop">
          <section className="jsr-modal">
            <span className="jsr-eyebrow">TAKE A BREATHER</span>
            <h2>{online ? 'Race menu' : 'Paused'}</h2>
            {online && (
              <p className="jsr-note">
                The online race keeps running. Your throttle is released.
              </p>
            )}
            {settings}
            <button
              className="jsr-primary"
              onClick={() => {
                unlock();
                setPaused(false);
              }}
            >
              <Play size={18} /> Continue racing
            </button>
            <button className="jsr-secondary" onClick={() => void leave()}>
              Return to lobby
            </button>
          </section>
        </div>
      )}
      {phase === 'finished' && (
        <div className="jsr-modal-backdrop">
          <section className="jsr-modal jsr-results">
            <span className="jsr-eyebrow">{track.name.toUpperCase()}</span>
            <Trophy className="jsr-trophy" size={34} />
            <h2>
              {results.find((v) => v.id === world.current.playerId)?.finished
                ? 'Across the line.'
                : 'Race complete.'}
            </h2>
            <p className="jsr-note">
              {online
                ? 'Official server results'
                : track.pointToPoint
                  ? 'Lana River sprint results'
                  : 'Coastal race results'}
            </p>
            <ol>
              {results.map((r, i) => (
                <li
                  className={r.id === world.current.playerId ? 'is-you' : ''}
                  key={r.id}
                >
                  <b>{i + 1}</b>
                  <span>
                    {r.name}
                    {r.ai ? ' · AI' : ''}
                    <small>
                      {r.bestLap
                        ? `Best ${track.pointToPoint ? 'run' : 'lap'} ${formatTime(r.bestLap)}`
                        : r.disconnected
                          ? 'Disconnected'
                          : 'Racing'}
                      {r.penalty ? ` · +${r.penalty}s` : ''}
                    </small>
                  </span>
                  <strong>
                    {r.finished ? formatTime(r.finishTime) : 'DNF'}
                  </strong>
                </li>
              ))}
            </ol>
            {!online && (
              <button className="jsr-primary" onClick={startAI}>
                Race again <RotateCcw size={18} />
              </button>
            )}
            {online && host && (
              <button
                className="jsr-primary"
                onClick={() => roomAction('rematch')}
              >
                Prepare rematch
              </button>
            )}
            <button className="jsr-secondary" onClick={() => void leave()}>
              Return to lobby
            </button>
            {error && <p className="jsr-error">{error}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
function MapAttribution() {
  return (
    <a
      className="jsr-map-attribution"
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      aria-label="Map data © OpenStreetMap contributors"
    >
      © OpenStreetMap
    </a>
  );
}
function MiniMap({
  track,
  racers = [],
  playerId = ''
}: {
  track: ReturnType<typeof makeTrack>;
  racers?: Racer[];
  playerId?: string;
}) {
  const first = track.points[0];
  const last = track.points[track.points.length - 1];
  // Keep the long river visible on a square portrait minimap, oriented forward.
  const angle = track.pointToPoint
    ? Math.atan2(last.x - first.x, last.z - first.z)
    : 0;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const originX = track.pointToPoint ? (first.x + last.x) / 2 : 0;
  const originZ = track.pointToPoint ? (first.z + last.z) / 2 : 0;
  const scale = track.pointToPoint ? 166 / track.totalLength : 0.55;
  const coordinates = (x: number, z: number) => [
    100 + ((x - originX) * cosine - (z - originZ) * sine) * scale,
    100 - ((x - originX) * sine + (z - originZ) * cosine) * scale
  ];
  const points = (track.pointToPoint ? track.points : [...track.points, first])
    .map((p) => coordinates(p.x, p.z).join(','))
    .join(' ');
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${track.name} course map`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        opacity=".16"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      {racers.map((r) => {
        const [cx, cy] = coordinates(r.x, r.z);
        return (
          <circle
            key={r.id}
            cx={cx}
            cy={cy}
            r={r.id === playerId ? 5 : 3}
            fill={r.id === playerId ? '#b8ff65' : COLORS[r.slot % 6]}
            stroke="#08222b"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
