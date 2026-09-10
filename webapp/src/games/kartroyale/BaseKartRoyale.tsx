import React, { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flag,
  LockKeyhole,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Settings2,
  X,
  Pause,
  Play,
  Copy,
  Check,
  Zap,
  RotateCcw,
  Cpu,
  Camera,
  Wifi,
  WifiOff,
  Wrench,
  Shield,
  Crosshair
} from 'lucide-react';
import { isMilitaryVehicle } from './militaryVehicleCatalog.mjs';
import { KartRenderer } from './renderer';
import type { Quality, Frame, Result, CameraMode } from './renderer';
import {
  COLORS,
  TRACKS,
  CUPS,
  KARTS,
  makeTrack,
  normalizeKart
} from './simulation.mjs';
import { loadCareer, recordRace, formatTime } from './career';
import { KartAudio } from './audio';
import { request, saveSession, loadSession } from './network';
import type { Room, Session } from './network';
import './kart-royale.css';
type Mode = 'ai' | 'online' | 'career';
interface Props {
  getSocket?: () => Promise<Socket>;
  onExit?: () => void;
  playerName?: string;
  renderOnlineLobby?: (props: {
    onMatched: (match: { tableId: string; accountId: string }) => Promise<void>;
    trackId: string;
    playerName: string;
    loaded: boolean;
    onResume: () => void;
    canResume: boolean;
  }) => React.ReactNode;
}
const maps = new Map(TRACKS.map((t) => [t.id, makeTrack(t.id)]));
const modes = [
  { id: 'ai', title: 'VS AI', sub: 'Find your racing line', icon: Cpu },
  { id: 'online', title: 'MULTIPLAYER', sub: 'Race your friends', icon: Users },
  { id: 'career', title: 'CAREER', sub: 'Build your legacy', icon: Trophy }
] as const;
function CircuitMap({ id, frame }: { id: string; frame?: Frame | null }) {
  const t = frame?.track || maps.get(id)!,
    extent = Math.max(t.x, t.z) + 12;
  const project = (x: number, z: number) =>
    `${(((x - t.center.x) / extent) * 42 + 50).toFixed(2)},${(((z - t.center.z) / extent) * 42 + 50).toFixed(2)}`;
  return (
    <svg
      className="kr-map"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${t.name} circuit map`}
    >
      <polyline
        points={t.points
          .filter((_, i) => i % 3 === 0)
          .map((p) => project(p.x, p.z))
          .concat(project(t.points[0].x, t.points[0].z))
          .join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {frame?.racers
        .filter((r) => !r.disconnected)
        .map((r) => (
          <circle
            key={r.id}
            cx={((r.x - t.center.x) / extent) * 42 + 50}
            cy={((r.z - t.center.z) / extent) * 42 + 50}
            r={r.ai ? 2 : 3}
            fill={r.color}
            stroke="#101819"
            strokeWidth=".7"
          />
        ))}
    </svg>
  );
}
export default function KartRoyale({
  getSocket,
  onExit,
  playerName = 'Racer',
  renderOnlineLobby
}: Props) {
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<KartRenderer | null>(null),
    audio = useRef<KartAudio | null>(null);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [mode, setMode] = useState<Mode>(renderOnlineLobby ? 'online' : 'ai'),
    [trackId, setTrackId] = useState('skanderbeg'),
    [difficulty, setDifficulty] = useState('rookie'),
    [paint, setPaint] = useState(0),
    [kartId, setKartId] = useState(() => {
      try {
        return normalizeKart(
          localStorage.getItem('racingRoyal.kart') || 'apex'
        );
      } catch {
        return 'apex';
      }
    });
  const [screen, setScreen] = useState<'lobby' | 'race' | 'results'>('lobby'),
    [hud, setHud] = useState<Frame | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [career, setCareer] = useState(loadCareer),
    [cup, setCup] = useState(0),
    [reward, setReward] = useState(0),
    [saved, setSaved] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    try {
      return localStorage.getItem('racingRoyal.camera') === 'chase'
        ? 'chase'
        : 'driver';
    } catch {
      return 'driver';
    }
  });
  const [muted, setMuted] = useState(() => {
      try {
        return localStorage.getItem('racingRoyal.muted') === 'true';
      } catch {
        return false;
      }
    }),
    [quality, setQuality] = useState<Quality>('auto'),
    [modal, setModal] = useState<'settings' | 'help' | 'pause' | null>(null);
  const [room, setRoom] = useState<Room | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [code, setCode] = useState(''),
    [name, setName] = useState(playerName),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [copied, setCopied] = useState(false),
    [resume, setResume] = useState(() => !!loadSession());
  const socket = useRef<Socket | null>(null),
    sessionRef = useRef(session),
    screenRef = useRef(screen),
    careerRef = useRef(career),
    raceCup = useRef<number | null>(null),
    done = useRef(false),
    count = useRef(0),
    cleanupSocket = useRef<(() => void) | null>(null),
    mounted = useRef(false),
    modalRef = useRef(modal);
  sessionRef.current = session;
  screenRef.current = screen;
  careerRef.current = career;
  modalRef.current = modal;
  const track = TRACKS.find((t) => t.id === trackId)!,
    activeTrack = mode === 'career' ? CUPS[cup].track : trackId;
  const finish = useRef<(r: Result) => void>(() => {});
  finish.current = (r) => {
    if (done.current) return;
    done.current = true;
    setResult(r);
    setScreen('results');
    setModal(null);
    engine.current?.clearInput();
    audio.current?.silence();
    audio.current?.beep(880, 0.3);
    if (!sessionRef.current) {
      const me = r.racers.find((p) => p.id === r.playerId)!,
        place = r.racers.indexOf(me) + 1,
        n = recordRace(
          careerRef.current,
          r.trackId,
          me.finished ? place : 7,
          me.finished ? me.finishTime : 0,
          raceCup.current
        );
      setCareer(n.career);
      setReward(n.reward);
      setSaved(n.saved);
    }
  };
  useEffect(() => {
    mounted.current = true;
    audio.current = new KartAudio();
    let active = true;
    try {
      const view = new KartRenderer(
        canvas.current!,
        (f) => {
          if (!active) return;
          setHud(f);
          audio.current?.update(
            f,
            screenRef.current === 'race' && !modalRef.current
          );
          if (f.countdown !== count.current) {
            count.current = f.countdown;
            audio.current?.beep(f.countdown === 0 ? 900 : 500, 0.15);
          }
        },
        (r) => finish.current(r),
        setError
      );
      engine.current = view;
      view
        .load()
        .then(() => {
          if (active) setLoaded(true);
        })
        .catch(() => {
          if (active)
            setError(
              'The kart could not load. Check your connection, then reload the game.'
            );
        });
    } catch {
      setError(
        'WebGL could not start. Try opening this game in your phone’s browser.'
      );
    }
    return () => {
      active = false;
      mounted.current = false;
      cleanupSocket.current?.();
      engine.current?.destroy();
      audio.current?.destroy();
    };
  }, []);
  useEffect(() => {
    engine.current?.setColor(COLORS[paint]);
  }, [paint, loaded]);
  useEffect(() => {
    engine.current?.setKart(kartId);
    try {
      localStorage.setItem('racingRoyal.kart', kartId);
    } catch {}
  }, [kartId, loaded]);
  useEffect(() => {
    engine.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    engine.current?.setCameraMode(cameraMode);
    try {
      localStorage.setItem('racingRoyal.camera', cameraMode);
    } catch {}
  }, [cameraMode, loaded]);
  useEffect(() => {
    audio.current?.setMuted(muted);
    try {
      localStorage.setItem('racingRoyal.muted', String(muted));
    } catch {}
  }, [muted]);
  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      const i = engine.current?.input;
      if (!i) return;
      i.steer =
        Number(keys.has('ArrowRight') || keys.has('d')) -
        Number(keys.has('ArrowLeft') || keys.has('a'));
      i.brake = keys.has('ArrowDown') || keys.has('s');
      i.drift = keys.has(' ');
      i.boost = keys.has('Shift');
      i.shield = keys.has('q');
      i.fire = keys.has('e');
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        screenRef.current !== 'race' ||
        modalRef.current ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowDown',
          'a',
          'd',
          's',
          ' ',
          'Shift',
          'q',
          'e'
        ].includes(key)
      ) {
        e.preventDefault();
        keys.add(key);
        apply();
      }
      if (e.key === 'Escape') setModal('pause');
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.delete(key);
      if (!modalRef.current) apply();
    };
    const blur = () => {
      keys.clear();
      engine.current?.clearInput();
      audio.current?.silence();
      if (screenRef.current === 'race' && !sessionRef.current)
        setModal('pause');
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    engine.current?.pause(modal === 'pause' && !session);
    if (modal) {
      engine.current?.clearInput();
      audio.current?.silence();
    }
    if (!modal) return;
    const prior = document.activeElement as HTMLElement | null,
      dialog = document.querySelector('.kr-modal');
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select,input'
        ) || []
      );
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const all = items(),
          first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, [modal, session]);
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      if (socket.current?.connected && screenRef.current === 'race')
        socket.current.emit('kart:input', engine.current?.input);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [session]);
  const connect = async () => {
    if (!getSocket)
      throw new Error(
        'Online racing is unavailable in this preview. VS AI and Career are ready to play.'
      );
    if (!socket.current) {
      const s = await getSocket();
      socket.current = s;
      const state = (r: Room) => {
        if (
          !mounted.current ||
          !sessionRef.current ||
          r.code !== sessionRef.current.code
        )
          return;
        setRoom(r);
        setNotice('');
        if (r.tableId && r.status === 'finished' && !r.racers.length) {
          setNotice(
            r.settlement?.status === 'refunded'
              ? 'Race cancelled. Your TPG stake was refunded.'
              : 'Race cancelled. Your TPG refund is processing.'
          );
          return;
        }
        if (['countdown', 'racing', 'finished'].includes(r.status)) {
          if (r.status === 'countdown') done.current = false;
          if (r.status !== 'finished') setScreen('race');
          engine.current?.networkState(r, sessionRef.current.playerId);
        } else if (screenRef.current !== 'lobby') {
          engine.current?.showGarage();
          audio.current?.silence();
          setScreen('lobby');
          setResult(null);
        }
      };
      const disconnected = () => {
        if (sessionRef.current)
          setNotice('Connection lost. Reconnecting to your race…');
        engine.current?.clearInput();
      };
      const reconnect = () => {
        if (sessionRef.current)
          request(s, 'resume', sessionRef.current).catch((e) =>
            setNotice(e.message)
          );
      };
      const closed = (d: { error: string }) => {
        saveSession(null);
        sessionRef.current = null;
        setSession(null);
        setRoom(null);
        setScreen('lobby');
        engine.current?.showGarage();
        audio.current?.silence();
        setNotice(d.error);
      };
      s.on('kart:state', state);
      s.on('disconnect', disconnected);
      s.on('connect', reconnect);
      s.on('kart:closed', closed);
      cleanupSocket.current = () => {
        s.off('kart:state', state);
        s.off('disconnect', disconnected);
        s.off('connect', reconnect);
        s.off('kart:closed', closed);
        if (sessionRef.current) s.emit('kart:leave', {});
      };
    }
    const s = socket.current;
    if (!s.connected) {
      s.connect();
      await new Promise<void>((resolve, reject) => {
        const clean = () => {
          clearTimeout(timer);
          s.off('connect', yes);
          s.off('connect_error', no);
        };
        const yes = () => {
          clean();
          resolve();
        };
        const no = () => {
          clean();
          reject(
            new Error(
              'Unable to connect. Sign in to TonPlaygram and try again.'
            )
          );
        };
        const timer = setTimeout(no, 10000);
        s.once('connect', yes);
        s.once('connect_error', no);
      });
    }
    return s;
  };
  const roomAction = async (action: 'create' | 'join' | 'quick' | 'resume') => {
    setBusy(true);
    setNotice('');
    try {
      const s = await connect(),
        data =
          action === 'resume'
            ? loadSession()
            : { name: name.trim() || 'Racer', trackId, code };
      if (!data) throw new Error('No saved race session was found.');
      const r = await request(s, action, data),
        n = {
          code: r.code!,
          playerId: r.playerId!,
          token: r.token!,
          ...(r.state?.tableId
            ? { tableId: r.state.tableId, accountId: r.playerId! }
            : {})
        };
      sessionRef.current = n;
      setSession(n);
      saveSession(n);
      if (r.state && ['waiting', 'countdown'].includes(r.state.status))
        await request(s, 'appearance', { kartId }).catch(() => {});
      setResume(false);
      if (r.state) {
        setRoom(r.state);
        if (r.state.status !== 'waiting') {
          done.current = false;
          setScreen('race');
          engine.current?.networkState(r.state, n.playerId);
        }
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const joinMatch = async (match: { tableId: string; accountId: string }) => {
    setBusy(true);
    try {
      const s = await connect();
      const reply = await request(s, 'match', match);
      if (!mounted.current) {
        s.emit('kart:leave', {});
        return;
      }
      const next = {
        code: reply.code!,
        playerId: reply.playerId!,
        token: reply.token!,
        tableId: match.tableId,
        accountId: match.accountId
      };
      sessionRef.current = next;
      setSession(next);
      saveSession(next);
      await request(s, 'appearance', { kartId }).catch(() => {});
      setResume(false);
      setNotice('');
      done.current = false;
      audio.current?.unlock();
      if (reply.state) {
        setRoom(reply.state);
        if (reply.state.status !== 'waiting') {
          setScreen('race');
          engine.current?.networkState(reply.state, next.playerId);
        }
      }
      // The final ready player may receive countdown just before its join ack.
      await request(s, 'sync');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const updateRoom = async (action: string, data: object = {}) => {
    setBusy(true);
    try {
      await request(await connect(), action, data);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const leave = () => {
    socket.current?.emit('kart:leave', {});
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    saveSession(null);
    setNotice('');
    setScreen('lobby');
    setModal(null);
    engine.current?.showGarage();
    audio.current?.silence();
  };
  const garage = () => {
    if (session) {
      leave();
      return;
    }
    engine.current?.showGarage();
    audio.current?.silence();
    setScreen('lobby');
    setModal(null);
    setResult(null);
  };
  const start = () => {
    if (!loaded) return;
    audio.current?.unlock();
    done.current = false;
    raceCup.current = mode === 'career' ? cup : null;
    setReward(0);
    setResult(null);
    setHud(null);
    setModal(null);
    setScreen('race');
    engine.current?.startLocal(
      activeTrack,
      mode === 'career' ? CUPS[cup].difficulty : difficulty
    );
  };
  const hold =
    (
      key: 'steer' | 'drift' | 'boost' | 'brake' | 'shield' | 'fire',
      value: number | boolean
    ) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      audio.current?.unlock();
      const i = engine.current?.input;
      if (i) (i as unknown as Record<string, number | boolean>)[key] = value;
    };
  const release =
    (key: 'steer' | 'drift' | 'boost' | 'brake' | 'shield' | 'fire') => () => {
      const i = engine.current?.input;
      if (i)
        (i as unknown as Record<string, number | boolean>)[key] =
          key === 'steer' ? 0 : false;
    };
  const touch = (
    key: 'steer' | 'drift' | 'boost' | 'brake' | 'shield' | 'fire',
    value: number | boolean
  ) => ({
    onPointerDown: hold(key, value),
    onPointerUp: release(key),
    onPointerCancel: release(key),
    onLostPointerCapture: release(key)
  });
  const copy = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice(`Share this room code: ${room.code}`);
    }
  };
  const me = room?.players.find((p) => p.id === session?.playerId),
    host = room?.hostId === session?.playerId,
    finishedMe = result?.racers.find((r) => r.id === result.playerId),
    place = result
      ? result.racers.findIndex((r) => r.id === result.playerId) + 1
      : 0;
  return (
    <div
      className={`kr-app kr-${screen}`}
      onPointerDownCapture={() => audio.current?.unlock()}
    >
      <div ref={canvas} className="kr-canvas" />
      <a
        className="kr-map-credit"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
      {screen === 'lobby' && (
        <>
          <div className="kr-vignette" />
          <header className="kr-header">
            <button
              className="kr-brand"
              onClick={onExit || (() => setMode('ai'))}
              aria-label="Return to games"
            >
              <span className="kr-brand-symbol">TP</span>
              <span>
                TONPLAYGRAM<small>RACING DIVISION</small>
              </span>
            </button>
            <div className="kr-header-actions">
              <span className="kr-wallet">
                <Trophy size={16} />
                <b>{career.credits}</b>
                <small>CR</small>
              </span>
              <button
                className="kr-icon"
                onClick={() => setModal('settings')}
                aria-label="Game settings"
              >
                <Settings2 size={19} />
              </button>
            </div>
          </header>
          <main className="kr-lobby-layout">
            <section className="kr-title">
              <div className="kr-eyebrow">
                <i />
                TIRANA STREET SERIES · 01
              </div>
              <h1>
                RACING
                <br />
                <em>ROYAL</em>
                <sup>®</sup>
              </h1>
              <p>YOUR STREETS. YOUR RACE.</p>
            </section>
            <section
              className={`kr-vehicle-info ${isMilitaryVehicle(kartId) ? 'kr-military-info' : ''}`}
            >
              <span className="kr-label">
                YOUR VEHICLE · {KARTS.length} CLASSES
              </span>
              <h2>{KARTS.find((k) => k.id === kartId)?.name}</h2>
              <p>{KARTS.find((k) => k.id === kartId)?.detail}</p>
              <select
                className="kr-vehicle-select"
                aria-label="Choose vehicle"
                value={kartId}
                disabled={!!room || busy}
                onChange={(e) => setKartId(normalizeKart(e.target.value))}
              >
                <optgroup label="Karts">
                  {KARTS.filter((k) => !isMilitaryVehicle(k.id)).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Military & armoured">
                  {KARTS.filter((k) => isMilitaryVehicle(k.id)).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {(() => {
                const k = KARTS.find((k) => k.id === kartId)!;
                return (
                  <div className="kr-kart-stats">
                    <span>
                      SPD <b>{Math.round(k.speed * 100)}</b>
                    </span>
                    <span>
                      HND <b>{Math.round(k.handling * 100)}</b>
                    </span>
                    <span>
                      BRK <b>{Math.round(k.brake * 100)}</b>
                    </span>
                    <span>
                      SHD <b>{k.shield}</b>
                    </span>
                    <span>
                      AMMO <b>{k.ammunition}</b>
                    </span>
                  </div>
                );
              })()}
              {!isMilitaryVehicle(kartId) && (
                <div className="kr-swatches">
                  {COLORS.slice(0, 5).map((c, i) => (
                    <button
                      key={c}
                      aria-label={`Select ${['lime', 'blue', 'pink', 'violet', 'orange'][i]} paint`}
                      aria-pressed={paint === i}
                      className={paint === i ? 'active' : ''}
                      style={{ '--swatch': c } as React.CSSProperties}
                      onClick={() => setPaint(i)}
                    />
                  ))}
                </div>
              )}
            </section>
            <section className="kr-controls-panel">
              <div className="kr-mode-list" aria-label="Race mode">
                {modes.map((m) => (
                  <button
                    className={`kr-mode ${mode === m.id ? 'active' : ''}`}
                    aria-pressed={mode === m.id}
                    disabled={
                      !!room || busy || (m.id === 'online' && !getSocket)
                    }
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setNotice('');
                    }}
                  >
                    <m.icon size={21} />
                    <span>
                      <b>{m.title}</b>
                      <small>
                        {m.id === 'online' && !getSocket
                          ? 'In TonPlaygram'
                          : m.sub}
                      </small>
                    </span>
                    {mode === m.id && <Check className="kr-tick" size={13} />}
                  </button>
                ))}
              </div>
              {mode === 'ai' && (
                <div className="kr-options">
                  <div className="kr-track-selector">
                    <div className="kr-track-mini">
                      <CircuitMap id={trackId} />
                    </div>
                    <div>
                      <span className="kr-label">{track.district}</span>
                      <h3>{track.name}</h3>
                      <p>
                        {(maps.get(trackId)!.length / 1000).toFixed(2)} km{' '}
                        <span>·</span> 3 laps
                      </p>
                    </div>
                    <div className="kr-track-arrows">
                      {[-1, 1].map((d) => (
                        <button
                          key={d}
                          className="kr-icon"
                          aria-label={
                            d < 0 ? 'Previous circuit' : 'Next circuit'
                          }
                          onClick={() =>
                            setTrackId(
                              TRACKS[
                                (TRACKS.findIndex((t) => t.id === trackId) +
                                  d +
                                  TRACKS.length) %
                                  TRACKS.length
                              ].id
                            )
                          }
                        >
                          {d < 0 ? (
                            <ChevronLeft size={20} />
                          ) : (
                            <ChevronRight size={20} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="kr-difficulty">
                    <span className="kr-label">AI LEVEL</span>
                    <div>
                      {['rookie', 'street', 'pro'].map((d) => (
                        <button
                          className={d === difficulty ? 'active' : ''}
                          aria-pressed={d === difficulty}
                          key={d}
                          onClick={() => setDifficulty(d)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {mode === 'career' && (
                <div className="kr-options">
                  <div className="kr-section-line">
                    <span className="kr-label">THE ROAD TO ROYALE</span>
                    <span>{career.cups.filter(Boolean).length}/3 CUPS</span>
                  </div>
                  <div className="kr-cups">
                    {CUPS.map((c, i) => {
                      const locked = i > 0 && !career.cups[i - 1];
                      return (
                        <button
                          key={c.name}
                          disabled={locked}
                          className={cup === i ? 'active' : ''}
                          onClick={() => setCup(i)}
                        >
                          {locked ? (
                            <LockKeyhole size={22} />
                          ) : (
                            <Trophy size={22} />
                          )}
                          <b>{c.name}</b>
                          <small>
                            {locked
                              ? 'Win previous cup'
                              : career.cups[i]
                                ? '★'.repeat(career.cups[i])
                                : i === 2
                                  ? 'Finish 1st'
                                  : 'Finish top 3'}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="kr-career-meta">
                    <span>
                      {TRACKS.find((t) => t.id === CUPS[cup].track)?.name} · 3
                      laps
                    </span>
                    <b>+{CUPS[cup].reward} CR</b>
                  </div>
                </div>
              )}
              {mode === 'online' && (
                <div className="kr-options kr-online">
                  {!room && (
                    <label className="kr-circuit-choice">
                      Tirana circuit
                      <select
                        className="kr-input"
                        aria-label="Online racing circuit"
                        value={trackId}
                        disabled={busy}
                        onChange={(e) => setTrackId(e.target.value)}
                      >
                        {TRACKS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {!room ? (
                    renderOnlineLobby ? (
                      renderOnlineLobby({
                        onMatched: joinMatch,
                        trackId,
                        playerName,
                        loaded: loaded && !error,
                        onResume: () => roomAction('resume'),
                        canResume: resume
                      })
                    ) : (
                      <>
                        <div className="kr-section-line">
                          <span className="kr-label">
                            2–6 PLAYERS · FREE RACING
                          </span>
                          <Wifi size={16} />
                        </div>
                        <input
                          className="kr-input"
                          aria-label="Racer name"
                          value={name}
                          maxLength={18}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your racer name"
                        />
                        <div className="kr-row">
                          <button
                            className="kr-secondary"
                            disabled={busy}
                            onClick={() => roomAction('quick')}
                          >
                            Quick match
                          </button>
                          <button
                            className="kr-secondary"
                            disabled={busy}
                            onClick={() => roomAction('create')}
                          >
                            Create room
                          </button>
                        </div>
                        <div className="kr-row">
                          <input
                            className="kr-input kr-code"
                            value={code}
                            maxLength={6}
                            onChange={(e) =>
                              setCode(
                                e.target.value
                                  .replace(/[^a-f0-9]/gi, '')
                                  .toUpperCase()
                              )
                            }
                            aria-label="Six-character room code"
                            placeholder="ROOM CODE"
                          />
                          <button
                            className="kr-secondary"
                            disabled={busy || code.length !== 6}
                            onClick={() => roomAction('join')}
                          >
                            Join <ArrowRight size={16} />
                          </button>
                        </div>
                        {resume && (
                          <button
                            className="kr-text"
                            disabled={busy}
                            onClick={() => roomAction('resume')}
                          >
                            Reconnect to previous room
                          </button>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <div className="kr-section-line">
                        <span className="kr-label">
                          {room.tableId
                            ? `${room.stake?.toLocaleString()} TPG RACE`
                            : room.public
                              ? 'PUBLIC ROOM'
                              : 'PRIVATE ROOM'}
                        </span>
                        <button className="kr-copy" onClick={copy}>
                          <b>
                            {room.tableId
                              ? room.code.slice(-8).toUpperCase()
                              : room.code}
                          </b>
                          {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>
                      <div className="kr-room-players">
                        {room.players.map((p, i) => (
                          <div key={p.id}>
                            <span style={{ color: COLORS[i] }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <b>
                              {p.name}
                              {p.id === session?.playerId ? ' (you)' : ''}
                            </b>
                            <small className={p.ready ? 'ready' : ''}>
                              {!p.connected
                                ? 'Reconnecting'
                                : p.ready
                                  ? 'Ready'
                                  : 'Not ready'}
                            </small>
                          </div>
                        ))}
                      </div>
                      <div className="kr-room-bottom">
                        <span>
                          {room.players.length}/
                          {room.tableId ? room.players.length : 6} ·{' '}
                          {TRACKS.find((t) => t.id === room.trackId)?.name}
                        </span>
                        <button className="kr-text" onClick={leave}>
                          Leave
                        </button>
                      </div>
                      <p className="kr-room-note">
                        {room.tableId
                          ? room.status === 'finished'
                            ? 'Return to the lobby to queue for another race.'
                            : 'Grid reserved. The countdown starts when every racer joins.'
                          : 'Empty seats fill with AI. Everyone must be ready.'}
                      </p>
                      {!room.tableId && (
                        <button
                          className="kr-secondary kr-full"
                          disabled={busy}
                          onClick={() =>
                            updateRoom('ready', { ready: !me?.ready })
                          }
                        >
                          {me?.ready ? (
                            <>
                              <Check size={17} /> You’re ready
                            </>
                          ) : (
                            'Ready to race'
                          )}
                        </button>
                      )}
                    </>
                  )}
                  {notice && (
                    <p className="kr-notice" role="status">
                      {notice}
                    </p>
                  )}
                </div>
              )}
              {mode !== 'online' ? (
                <button
                  className="kr-start"
                  disabled={!loaded || !!error}
                  onClick={start}
                >
                  <Flag size={23} />
                  <span>
                    {!loaded
                      ? 'LOADING YOUR KART…'
                      : mode === 'career'
                        ? 'RACE FOR THE CUP'
                        : 'LET’S RACE'}
                  </span>
                  <ArrowRight size={23} />
                </button>
              ) : (
                room &&
                !room.tableId && (
                  <button
                    className="kr-start"
                    disabled={
                      busy ||
                      !host ||
                      room.players.length < 2 ||
                      room.players.some((p) => !p.ready || !p.connected) ||
                      !loaded
                    }
                    onClick={() => {
                      audio.current?.unlock();
                      updateRoom('start');
                    }}
                  >
                    <Flag size={23} />
                    <span>{host ? 'START RACE' : 'WAITING FOR HOST'}</span>
                    <ArrowRight size={23} />
                  </button>
                )
              )}
              <div className="kr-panel-footer">
                <span>
                  {mode === 'career'
                    ? 'Progress saved on this device'
                    : mode === 'online'
                      ? renderOnlineLobby
                        ? 'TPG races · Shared Royal matchmaking'
                        : 'Live races · No entry fee'
                      : 'Auto throttle · Touch & keyboard'}
                </span>
                <button onClick={() => setModal('help')}>
                  How to play <b>?</b>
                </button>
              </div>
            </section>
            <div className="kr-garage-bottom">
              <span>FIVE CIRCUITS. ONE TIRANA.</span>
              <span>EST. TONPLAYGRAM</span>
            </div>
          </main>
        </>
      )}
      {screen === 'race' && (
        <div className="kr-race-ui">
          <div className="kr-race-top">
            <div className="kr-position">
              <b>{hud?.position || 1}</b>
              <span>
                / {hud?.racers.length || 6}
                <br />
                POSITION
              </span>
            </div>
            <div className="kr-lap">
              <span>
                LAP <b>{hud?.lap || 1}</b> / 3
              </span>
              <time>{formatTime(hud?.time || 0)}</time>
            </div>
            <button
              className="kr-icon"
              aria-label="Pause menu"
              onClick={() => setModal('pause')}
            >
              <Pause size={20} />
            </button>
          </div>
          <div className="kr-race-side">
            <div className="kr-race-map">
              <CircuitMap id={trackId} frame={hud} />
            </div>
            <small>{hud?.fps || '—'} FPS</small>
          </div>
          <button
            className="kr-camera-toggle"
            aria-label={`Switch to ${cameraMode === 'driver' ? 'chase' : 'driver'} camera`}
            onClick={() =>
              setCameraMode((v) => (v === 'driver' ? 'chase' : 'driver'))
            }
          >
            <Camera size={17} /> {cameraMode === 'driver' ? 'DRIVER' : 'CHASE'}
          </button>
          {(hud?.countdown || 0) > 0 && (
            <div className="kr-countdown">
              <span>GET READY</span>
              <b>{hud!.countdown}</b>
              <small>Auto throttle. Hold left or right to steer.</small>
            </div>
          )}
          {hud?.drifting && (
            <div className="kr-drift-label">
              {hud.driftCharge > 0.5 ? 'RELEASE FOR TURBO' : 'CHARGING DRIFT'}
              <div>
                <i
                  style={{
                    width: `${Math.min(100, (hud.driftCharge / 1.5) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
          {notice && (
            <div className="kr-race-notice">
              <WifiOff size={16} />
              {notice}
            </div>
          )}
          <div className="kr-speed">
            <b>{Math.round((hud?.speed || 0) * 3.6)}</b>
            <span>KM/H</span>
          </div>
          <div className="kr-integrity-hud">
            <div
              className="kr-health"
              aria-label={`${Math.round(hud?.health ?? 100)} percent car health`}
            >
              <span>
                <Wrench size={14} /> INTEGRITY
              </span>
              <div>
                <i style={{ width: `${hud?.health ?? 100}%` }} />
              </div>
              <b>{Math.round(hud?.health ?? 100)}</b>
            </div>
            <small>
              {(hud?.health ?? 100) > 70
                ? 'RACE READY'
                : (hud?.health ?? 100) > 40
                  ? 'BODYWORK DAMAGED'
                  : 'ENGINE DAMAGED · SLOW DOWN'}
            </small>
          </div>
          <div className="kr-combat-hud" aria-label="Combat supplies">
            <span>
              <Shield size={13} /> {Math.round(hud?.shield || 0)}
            </span>
            <span>
              <Crosshair size={13} /> {hud?.ammunition || 0}
            </span>
          </div>
          <div className="kr-touch-controls">
            <div className="kr-steering">
              <button aria-label="Steer left" {...touch('steer', -1)}>
                <ChevronLeft size={35} />
              </button>
              <button aria-label="Steer right" {...touch('steer', 1)}>
                <ChevronRight size={35} />
              </button>
            </div>
            <div className="kr-pedals">
              <div className="kr-combat-buttons">
                <button
                  className="kr-shield-button"
                  aria-label="Hold shield"
                  disabled={!hud?.shield}
                  {...touch('shield', true)}
                >
                  <Shield size={22} />
                  <span>SHIELD</span>
                </button>
                <button
                  className="kr-fire-button"
                  aria-label="Fire missile"
                  disabled={!hud?.ammunition}
                  {...touch('fire', true)}
                >
                  <Crosshair size={22} />
                  <span>FIRE</span>
                </button>
              </div>
              <button className="kr-drift-button" {...touch('drift', true)}>
                DRIFT
              </button>
              <div className="kr-pedal-column">
                <button
                  className="kr-brake"
                  aria-label="Brake"
                  {...touch('brake', true)}
                >
                  BRAKE
                </button>
                <button
                  className="kr-boost-button"
                  aria-label="Hold boost"
                  {...touch('boost', true)}
                >
                  <Zap size={28} />
                  <span>BOOST</span>
                  <i style={{ height: `${hud?.boost || 0}%` }} />
                </button>
              </div>
            </div>
          </div>
          <div className="kr-key-hint">
            ← → STEER <span>SPACE DRIFT</span> SHIFT BOOST · Q SHIELD · E FIRE
          </div>
        </div>
      )}
      {screen === 'results' && result && (
        <div className="kr-results-backdrop">
          <section className="kr-results">
            <div className="kr-eyebrow">
              <Flag size={16} /> RACE COMPLETE
            </div>
            <div className="kr-finish-place">
              {finishedMe?.finished ? String(place).padStart(2, '0') : 'DNF'}
              <span>
                {finishedMe?.finished
                  ? place === 1
                    ? 'VICTORY'
                    : 'FINISH POSITION'
                  : finishedMe?.retired
                    ? 'KART RETIRED'
                    : 'RACE ENDED'}
              </span>
            </div>
            <h2>
              {place === 1 && finishedMe?.finished
                ? 'THE STREETS ARE YOURS.'
                : 'ONE MORE LAP? ONE MORE RACE.'}
            </h2>
            <p>
              {TRACKS.find((t) => t.id === result.trackId)?.name} ·{' '}
              {formatTime(finishedMe?.finishTime || result.elapsed)}
            </p>
            <div className="kr-result-table">
              {result.racers.map((r, i) => (
                <div
                  key={r.id}
                  className={r.id === result.playerId ? 'you' : ''}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <b>{r.name}</b>
                  <small>
                    {r.ai ? 'AI' : r.id === result.playerId ? 'YOU' : 'PLAYER'}
                  </small>
                  <span>
                    {r.finished
                      ? formatTime(r.finishTime)
                      : r.disconnected
                        ? 'LEFT'
                        : session
                          ? 'DNF'
                          : `Lap ${Math.max(1, r.lap)}`}
                  </span>
                </div>
              ))}
            </div>
            {reward > 0 && (
              <div className="kr-reward">
                <Trophy size={20} /> CUP COMPLETE <b>+{reward} CR</b>
              </div>
            )}
            {!saved && (
              <p className="kr-notice">
                This browser could not save your progress.
              </p>
            )}
            {session ? (
              <>
                {room?.tableId ? (
                  <>
                    <p className="kr-notice" role="status">
                      {room.settlement?.status === 'paid'
                        ? room.settlement.winnerAccountId === session.playerId
                          ? `You won ${room.settlement.amount?.toLocaleString()} TPG. Your balance is updated.`
                          : 'The race winner received the TPG pot.'
                        : room.settlement?.status === 'refunded'
                          ? `${room.settlement.amount?.toLocaleString()} TPG refunded to each racer.`
                          : 'Confirming the TPG result…'}
                    </p>
                    <button className="kr-start" onClick={garage}>
                      BACK TO TPG LOBBY
                    </button>
                  </>
                ) : (
                  <button
                    className="kr-start"
                    disabled={!host || busy}
                    onClick={() => updateRoom('rematch')}
                  >
                    <RotateCcw size={20} />
                    {host ? 'REMATCH' : 'WAITING FOR HOST'}
                  </button>
                )}
                {!room?.tableId && (
                  <button className="kr-secondary kr-full" onClick={garage}>
                    Leave room
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="kr-start" onClick={start}>
                  <RotateCcw size={20} /> RACE AGAIN <ArrowRight size={20} />
                </button>
                <button className="kr-secondary kr-full" onClick={garage}>
                  <ArrowLeft size={17} /> BACK TO GARAGE
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {modal && (
        <div className="kr-modal-backdrop">
          <section
            className="kr-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'settings'
                ? 'Game settings'
                : modal === 'help'
                  ? 'How to play'
                  : 'Pause menu'
            }
          >
            <button
              className="kr-icon kr-close"
              aria-label="Close menu"
              onClick={() => setModal(null)}
            >
              <X size={21} />
            </button>
            <div className="kr-eyebrow">RACING ROYAL</div>
            <h2>
              {modal === 'settings'
                ? 'Make it yours.'
                : modal === 'help'
                  ? 'Find your racing line.'
                  : session
                    ? 'PIT MENU'
                    : 'TAKE A BREATHER.'}
            </h2>
            {modal === 'settings' ? (
              <>
                <label className="kr-setting">
                  <span>Camera</span>
                  <select
                    value={cameraMode}
                    onChange={(e) =>
                      setCameraMode(e.target.value as CameraMode)
                    }
                  >
                    <option value="driver">Driver view</option>
                    <option value="chase">Chase view</option>
                  </select>
                </label>
                <label className="kr-setting">
                  <span>Graphics</span>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as Quality)}
                  >
                    <option value="auto">Adaptive</option>
                    <option value="high">High resolution</option>
                    <option value="performance">Performance</option>
                  </select>
                </label>
                <button
                  className="kr-setting"
                  onClick={() => {
                    audio.current?.unlock();
                    setMuted((v) => !v);
                  }}
                >
                  <span>Engine & race audio</span>
                  {muted ? (
                    <>
                      <VolumeX size={20} /> Off
                    </>
                  ) : (
                    <>
                      <Volume2 size={20} /> On
                    </>
                  )}
                </button>
                <p>
                  Adaptive graphics adjusts resolution during a race to keep
                  controls responsive.
                </p>
                <p>
                  Career progress and achievement credits stay on this device.
                </p>
                <details className="kr-credits">
                  <summary>Free asset credits</summary>
                  <p>
                    Kart by{' '}
                    <a
                      href="https://poly.pizza/m/fLovOv3TAH"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Scaranto
                    </a>
                    , karts by{' '}
                    <a
                      href="https://kenney.nl/assets/car-kit"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Kenney
                    </a>
                    , asphalt by{' '}
                    <a
                      href="https://polyhaven.com/a/asphalt_02"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Rob Tuytel / Poly Haven
                    </a>
                    . Karts and asphalt: CC0. Supporters reuse the male and
                    female Quaternius characters from Table Tennis Royal (CC0).
                    Adapted for TonPlaygram. Tirana geography:{' '}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                    >
                      © OpenStreetMap contributors · ODbL
                    </a>
                    . Albanian flag:{' '}
                    <a
                      href="https://github.com/lipis/flag-icons"
                      target="_blank"
                      rel="noreferrer"
                    >
                      flag-icons · MIT
                    </a>
                    .
                    <a
                      href="/assets/kart-royale/ATTRIBUTION.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Credits and sources
                    </a>
                    .
                  </p>
                </details>
              </>
            ) : modal === 'help' ? (
              <>
                <div className="kr-howto">
                  <b>01 · Hit the racing line.</b>
                  <p>
                    Your kart accelerates automatically. Hold left and right to
                    steer. Brake before tight corners.
                  </p>
                  <b>02 · Turn a drift into speed.</b>
                  <p>
                    Hold DRIFT while steering. Charge the meter, then release
                    for a short turbo.
                  </p>
                  <b>03 · Make your move.</b>
                  <p>
                    Hold BOOST on the straights. Use SHIELD to absorb attacks
                    and FIRE when you have ammunition. Finish three complete
                    laps. The harder you crash, the more bodywork and engine
                    damage you take. Small bumps are forgiving. At zero
                    integrity your kart retires.
                  </p>
                  <b>04 · Watch the crowd.</b>
                  <p>
                    Supporters throw eggs and tomatoes. Steer away from their
                    flight paths. Splashes clear automatically and do not damage
                    your kart. Tap the camera button to change your view.
                  </p>
                </div>
                <p>
                  Keyboard: arrows or A/D to steer, Space to drift, Shift to
                  boost, down arrow to brake, Q to shield and E to fire.
                </p>
              </>
            ) : (
              <>
                {session && (
                  <p>The online race continues while this menu is open.</p>
                )}
                <button className="kr-start" onClick={() => setModal(null)}>
                  <Play size={20} /> BACK TO RACING
                </button>
                <button className="kr-secondary kr-full" onClick={garage}>
                  <ArrowLeft size={18} />
                  {session ? 'LEAVE RACE' : 'RETURN TO GARAGE'}
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {error && (
        <div className="kr-fatal" role="alert">
          <h2>Let’s get you racing.</h2>
          <p>{error}</p>
          <button className="kr-start" onClick={() => location.reload()}>
            Reload game
          </button>
        </div>
      )}
    </div>
  );
}
