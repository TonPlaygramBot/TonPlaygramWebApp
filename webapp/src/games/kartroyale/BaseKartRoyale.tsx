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
  WifiOff
} from 'lucide-react';
import { createHeldRaceInput } from './heldRaceInput.mjs';
import { KartControls } from './KartControls';
import {CombatControls,createHeldActionInput} from './ActionControls';
import { KartRenderer } from './renderer';
import type { Quality, Frame, Result, CameraMode } from './renderer';
import {
  COLORS,
  TRACKS,
  KARTS,
  makeTrack,
  normalizeKart,
  normalizeTrack
} from './simulation.mjs';
import { loadCareer, recordRace, formatTime } from './career';
import {CAPTAIN_ID,CAPTAIN_NAME,captainDuelOutcome} from './captainDuel.mjs';
import {firstBattleEvent,recordFirstBattleFinish,FIRST_BATTLE_COURSE_ID,FIRST_BATTLE_MISSION_ID} from './battleCareerClassic.mjs';
import {readBattleCareer,saveBattleCareer} from './kartBattleCareer.mjs';

import { KartAudio } from './audio';
import {RaceTelemetryHud,RaceRevBar,RaceDebrief} from './RaceTelemetryHud';
import { request, saveSession, loadSession } from './network';
import { bestTrialLap, type RaceFormat } from './raceFormats.mjs';
import type { Room, Session } from './network';
import './kart-royale.css';
import './kart-mobile.css';
import './kart-controls.css';

function readLocalBattleCareer() {
  try { return readBattleCareer(localStorage); }
  catch { return readBattleCareer({getItem:()=>null}); }
}

type Mode = 'ai' | 'online';
interface Props {
  getSocket?: () => Promise<Socket>;
  onExit?: () => void;
  onCareer?: () => void;
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
const modes = [
  { id: 'ai', title: 'VS AI', sub: 'Find your racing line', icon: Cpu },
  { id: 'online', title: 'MULTIPLAYER', sub: 'Race your friends', icon: Users }
] as const;
function CircuitMap({ id, frame }: { id: string; frame?: Frame | null }) {
  // makeTrack caches geometry; importing the garage must not build every route.
  const t = frame?.track || makeTrack(id),
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
  onCareer,
  playerName = 'Racer',
  renderOnlineLobby
}: Props) {
  const canvas = useRef<HTMLDivElement>(null),
    engine = useRef<KartRenderer | null>(null),
    audio = useRef<KartAudio | null>(null);
  const swipeStart = useRef<{ x: number; y: number; pointer: number } | null>(
    null
  );
  const slideDirection = useRef(0);
  const heldInput = useRef(createHeldRaceInput());
  const combatHeld = useRef(createHeldActionInput());
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [mode, setMode] = useState<Mode>('ai'),
    [raceFormat] = useState<RaceFormat>('race'),
    [onlineEntry, setOnlineEntry] = useState<'free'|'tpg'>(renderOnlineLobby ? 'tpg' : 'free'),
    [trackId, setTrackId] = useState(TRACKS[0].id),
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
    [captainDuel,setCaptainDuel]=useState(false),
    [battleEvent,setBattleEvent]=useState(false),
    [battleProgress,setBattleProgress]=useState(readLocalBattleCareer),
    [battleXp,setBattleXp]=useState(0),
    [battlePassed,setBattlePassed]=useState(false),
    [career, setCareer] = useState(loadCareer),
    [reward, setReward] = useState(0),
    [saved, setSaved] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    try {
      return localStorage.getItem('racingRoyal.camera') === 'driver'
        ? 'driver'
        : 'chase';
    } catch {
      return 'chase';
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
    pendingBattle = useRef(false),
    done = useRef(false),
    cleanupSocket = useRef<(() => void) | null>(null),
    mounted = useRef(false),
    modalRef = useRef(modal),
    formatRef = useRef(raceFormat),
    roomRef = useRef(room);
  formatRef.current = room?.raceFormat || raceFormat;
  roomRef.current = room;
  sessionRef.current = session;
  screenRef.current = screen;
  careerRef.current = career;
  modalRef.current = modal;
  const track = (TRACKS.find((t) => t.id === normalizeTrack(trackId)) || TRACKS[0]),
    activeTrack = trackId;
  const finish = useRef<(r: Result) => void>(() => {});
  finish.current = (r) => {
    if (done.current) return;
    done.current = true;
    setResult(r);
    setScreen('results');
    setModal(null);
    heldInput.current.clear();combatHeld.current.clear();
    engine.current?.clearInput();
    audio.current?.silence();
    audio.current?.beep(880, 0.3);
    if (pendingBattle.current || r.battleCareerMission) {
      const launched = pendingBattle.current;
      pendingBattle.current = false;
      if (!launched || sessionRef.current || roomRef.current) return;
      const prior = readLocalBattleCareer();
      const report = recordFirstBattleFinish(prior,r);
      const persisted = !report.accepted || (() => {
        try { return saveBattleCareer(localStorage,report.progress); }
        catch { return false; }
      })();
      setBattleProgress(persisted?report.progress:prior);
      setBattleXp(persisted?report.xpAward:0);
      setBattlePassed(report.accepted);
      setSaved(persisted);
      return;
    }
    // A solo challenge never records a career cup, shared time or TPG result.
    if(r.captainDuel&&!r.online){setSaved(true);return;}
    if(r.combat){setSaved(true);return;}
    if(r.timeTrial){setSaved(r.ghostSaved!==false);return;}
    if (!sessionRef.current || (!sessionRef.current.tableId && roomRef.current?.raceFormat === 'championship')) {
      const me = r.racers.find((p) => p.id === r.playerId)!,
        place = r.racers.indexOf(me) + 1,
        n = recordRace(
          careerRef.current,
          r.trackId,
          me.finished ? place : 7,
          me.finished ? me.finishTime : 0,
          sessionRef.current ? roomRef.current?.cupIndex ?? null : raceCup.current
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
    engine.current?.setKart(kartId, slideDirection.current);
    slideDirection.current = 0;
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
    const mapping: Record<string, [string, number | boolean]> = {
      ArrowRight:['steer',1],d:['steer',1],ArrowLeft:['steer',-1],a:['steer',-1],
      ArrowUp:['throttle',true],w:['throttle',true],ArrowDown:['brake',true],s:['brake',true],r:['reverse',true],' ':['drift',true],Shift:['boost',true],e:['useItem',true]
    };
    const apply = () => { if(engine.current){Object.assign(engine.current.input,heldInput.current.read());engine.current.combatInput.reload=combatHeld.current.read().reload;} };
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        screenRef.current !== 'race' ||
        modalRef.current ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.closest?.('textarea,[contenteditable="true"]') ||
        e.ctrlKey || e.metaKey || e.altKey
      )
        return;
      if(formatRef.current==='combat'&&['f','q','r','e'].includes(key)){
        e.preventDefault();
        if(key==='e'){if(!e.repeat)engine.current?.queueCombatPulse();}
        else if(key==='r'){combatHeld.current.hold(`key:${key}`,'reload',true);if(!e.repeat)engine.current?.queueCombatReload();}
        else heldInput.current.hold(`key:${key}`,key==='f'?'fire':'shield',true);
        apply();
      }else if (mapping[key]) {
        e.preventDefault(); heldInput.current.hold(`key:${key}`, ...mapping[key]); apply();
      }
      if (e.key === 'Escape') setModal('pause');
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      heldInput.current.release(`key:${key}`);combatHeld.current.release(`key:${key}`);
      if (!modalRef.current) apply();
    };
    const blur = () => {
      heldInput.current.clear();combatHeld.current.clear();
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
      heldInput.current.clear();combatHeld.current.clear();
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
        socket.current.emit('kart:input', engine.current?.networkInput());
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [session]);
  const connect = async () => {
    if (!getSocket)
      throw new Error(
        'Online racing is unavailable in this preview. VS AI activities are ready to play.'
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
        roomRef.current = r;
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
          if (r.status === 'countdown') {done.current = false;setReward(0);setSaved(true);}
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
            : { name: name.trim() || 'Racer', trackId: activeTrack, code, raceFormat: 'race' };
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
        roomRef.current = r.state;
        setMode('online');
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
      setReward(0);
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
    heldInput.current.clear();combatHeld.current.clear();
    if (session) {
      leave();
      return;
    }
    engine.current?.showGarage();
    audio.current?.silence();
    setScreen('lobby');
    setModal(null);
    setResult(null);
    setCaptainDuel(false);
    setBattleEvent(false);
    pendingBattle.current = false;
  };
  const start = (duel=false,battle=false) => {
    if (!loaded || !engine.current || sessionRef.current || ((duel||battle)&&(mode!=='ai'||roomRef.current||busy||!!error))) return;
    if (battle && (!firstBattleEvent(FIRST_BATTLE_MISSION_ID,FIRST_BATTLE_COURSE_ID)
      || !TRACKS.some(t=>t.id===FIRST_BATTLE_COURSE_ID))) return;
    heldInput.current.clear();combatHeld.current.clear();
    audio.current?.unlock();
    done.current = false;
    raceCup.current = null;
    setReward(0);
    setResult(null);
    setHud(null);
    setModal(null);
    setCaptainDuel(duel);
    setBattleEvent(battle);
    setBattleXp(0);
    setBattlePassed(false);
    pendingBattle.current = battle;
    setScreen('race');
    if(battle)engine.current.startFirstBattleCareer(difficulty);
    else if(duel)engine.current.startCaptainDuel(trackId,difficulty);
    else engine.current.startLocal(trackId,difficulty,false);
  };
  const touch = (key: 'steer'|'drift'|'boost'|'brake'|'reverse'|'recover', value: number|boolean) => {
    const release = (e: React.PointerEvent<HTMLButtonElement>) => {
      heldInput.current.release(`touch:${e.pointerId}`);
      if(engine.current) Object.assign(engine.current.input,heldInput.current.read());
    };
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);audio.current?.unlock();
        heldInput.current.hold(`touch:${e.pointerId}`,key,value);
        if(engine.current)Object.assign(engine.current.input,heldInput.current.read());
      },
      onPointerUp:release,onPointerCancel:release,onLostPointerCapture:release
    };
  };
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
  const changeVehicle = (direction: number) => {
    if (!loaded || room || busy || screen !== 'lobby') return;
    slideDirection.current = direction;
    setKartId(
      (current) =>
        KARTS[
          (KARTS.findIndex((k) => k.id === current) +
            direction +
            KARTS.length) %
            KARTS.length
        ].id
    );
  };
  const selectedFormat = room?.raceFormat || raceFormat;
  const me = room?.players.find((p) => p.id === session?.playerId),
    host = room?.hostId === session?.playerId,
    finishedMe = result?.racers.find((r) => r.id === result.playerId),
    place = result
      ? result.racers.findIndex((r) => r.id === result.playerId) + 1
      : 0;
  const firstMission=firstBattleEvent(FIRST_BATTLE_MISSION_ID,FIRST_BATTLE_COURSE_ID);
  const battleComplete=battleProgress.completedMissionIds.includes(FIRST_BATTLE_MISSION_ID);
  const duelResult=result?.captainDuel&&!result.online;
  const duelOutcome=duelResult?captainDuelOutcome(finishedMe,result?.racers.find(r=>r.id===CAPTAIN_ID)):null;
  const rankedTrial = !!(session && result?.timeTrial && finishedMe && Number.isFinite(bestTrialLap(finishedMe)));
  return (
    <div
      className={`kr-app rr-remake kr-${screen}`}
      onPointerDownCapture={(e) => {
        audio.current?.unlock();
        if (screen !== 'lobby' || !loaded || room || busy || modal) return;
        if (
          (e.target as HTMLElement).closest(
            'button, a, input, select, textarea, [role="dialog"]'
          )
        )
          return;
        swipeStart.current = {
          x: e.clientX,
          y: e.clientY,
          pointer: e.pointerId
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || start.pointer !== e.pointerId) return;
        const dx = e.clientX - start.x,
          dy = e.clientY - start.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3)
          changeVehicle(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
      onLostPointerCapture={() => {
        swipeStart.current = null;
      }}
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
            <section className="rr-garage-heading">
              <span>CITY CIRCUIT SERIES</span><h1>Tirana <em>Racing Streets</em></h1>
            </section>
            <div className="rr-showcase" aria-hidden="true" />
            <section className="rr-kart-picker" aria-label="Choose your kart">
              <div className="rr-kart-title">
                <button className="kr-icon" aria-label="Previous kart" disabled={!loaded || !!room || busy} onClick={()=>changeVehicle(-1)}><ChevronLeft/></button>
                <div><span className="kr-label">KART {KARTS.findIndex(k=>k.id===kartId)+1} / {KARTS.length}</span><h2>{KARTS.find(k=>k.id===kartId)?.name}</h2><p>{KARTS.find(k=>k.id===kartId)?.detail}</p></div>
                <button className="kr-icon" aria-label="Next kart" disabled={!loaded || !!room || busy} onClick={()=>changeVehicle(1)}><ChevronRight/></button>
              </div>
              <div className="rr-kart-bottom">
                <div className="kr-swatches">{COLORS.slice(0,5).map((c,i)=><button key={c} aria-label={`Select ${['lime','blue','pink','violet','orange'][i]} paint`} aria-pressed={paint===i} className={paint===i?'active':''} style={{'--swatch':c} as React.CSSProperties} onClick={()=>setPaint(i)}/>)}</div>
                <div className="rr-stats"><span>SPEED <b>{Math.round((KARTS.find(k=>k.id===kartId)?.speed||1)*100)}</b></span><span>GRIP <b>{Math.round((KARTS.find(k=>k.id===kartId)?.handling||1)*100)}</b></span></div>
              </div>
            </section>
            <section className="kr-controls-panel">
              {onCareer&&<button className="kr-mode" disabled={!!room || !!session || busy} onClick={() => {if (!busy && !sessionRef.current && !roomRef.current) onCareer();}}>CAREER · TIRANA STREET SERIES</button>}
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
              {mode === 'ai' && selectedFormat !== 'championship' && (
                <div className="kr-options">
                  <div className="kr-track-selector">
                    <div className="kr-track-mini">
                      <CircuitMap id={trackId} />
                    </div>
                    <div>
                      <span className="kr-label">{track.district}</span>
                      <h3>{track.name}</h3>
                      <p>
                        {(makeTrack(trackId).length / 1000).toFixed(2)} km{' '}
                        <span>·</span> 3 laps
                      </p>
                      {track.routeStats&&<p className="kr-route-width">{Math.round(track.routeStats.broadRoadShare*100)}% broad roads · {track.routeStats.averageSourceWidth.toFixed(1)} m average</p>}
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
                  {selectedFormat!=='trial'&&<div className="kr-difficulty">
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
                  </div>}
                </div>
              )}
              {mode === 'online' && (
                <div className="kr-options kr-online">
                  {!room && selectedFormat !== 'championship' && (
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
                  {!room && renderOnlineLobby && selectedFormat==='race' && <div className="kr-row" aria-label="Online race entry">
                    <button className="kr-secondary" aria-pressed={onlineEntry==='free'} onClick={()=>setOnlineEntry('free')}>FREE ROOMS</button>
                    <button className="kr-secondary" aria-pressed={onlineEntry==='tpg'} onClick={()=>setOnlineEntry('tpg')}>TPG RACES</button>
                  </div>}
                  {!room ? (
                    renderOnlineLobby && onlineEntry==='tpg' && selectedFormat==='race' ? (
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
                          {room.raceFormat==='trial'?'TIME TRIAL · ':room.raceFormat==='combat'?'COMBAT · ':room.raceFormat==='championship'?'CUP · ':''}{room.players.length}/
                          {room.tableId ? room.players.length : 6} ·{' '}
                          {TRACKS.find((t) => t.id === normalizeTrack(room.trackId))?.name}
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
                          : room.raceFormat==='trial' ? 'Fastest valid lap wins. Everyone must be ready. No kart collisions.' : 'Empty seats fill with AI. Everyone must be ready.'}
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
                  onClick={()=>start()}
                >
                  <Flag size={23} />
                  <span>
                    {!loaded
                      ? 'LOADING YOUR KART…'
                      : selectedFormat === 'trial' ? 'CHASE YOUR BEST'
                      : selectedFormat === 'combat' ? 'START COMBAT RACE'
                      : selectedFormat === 'championship'
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
              {mode==='ai'&&selectedFormat==='race'&&<button className="kr-secondary kr-captain-launch"
                disabled={!loaded||!!error||!!room||!!session||busy} onClick={()=>start(true)}>
                <Trophy size={18} aria-hidden="true"/><span><b>ALI DEMI CAPTAIN DUEL</b>
                <small>1 vs 1 · Selected circuit · No credits or records</small></span><ArrowRight size={17} aria-hidden="true"/>
              </button>}
              {mode==='ai'&&selectedFormat==='race'&&firstMission&&TRACKS.some(t=>t.id===FIRST_BATTLE_COURSE_ID)&&
                <button className="kr-secondary kr-captain-launch kr-battle-launch"
                  disabled={!loaded||!!error||!!room||!!session||busy} onClick={()=>start(false,true)}>
                  <Flag size={18} aria-hidden="true"/><span><b>BATTLE CAREER · VIJA E PARË</b>
                  <small>Brryli · Top 3 of 6 · {battleComplete?`Completed · ${battleProgress.xp} XP`:`${firstMission.xpAward} local XP · No entry fee`}</small></span>
                  <ArrowRight size={17} aria-hidden="true"/>
                </button>}
              <div className="kr-panel-footer">
                <span>
                  {selectedFormat === 'championship'
                    ? 'Progress saved on this device'
                    : mode === 'online'
                      ? renderOnlineLobby && onlineEntry==='tpg' && selectedFormat==='race'
                        ? 'TPG races · Shared Royal matchmaking'
                        : 'Live races · No entry fee'
                      : 'Manual gas · Touch & keyboard'}
                </span>
                <button onClick={() => setModal('help')}>
                  How to play <b>?</b>
                </button>
              </div>
            </section>
            <div className="kr-garage-bottom">
              <span>{TRACKS.length} CIRCUITS · EIGHT KARTS. ONE TIRANA.</span>
              <span>EST. TONPLAYGRAM</span>
            </div>
          </main>
        </>
      )}
      {screen === 'race' && (
        <div className="rr-race-ui">
          <div className="rr-race-top">
            <div className="rr-place"><b>{hud?.position || 1}</b><span>/{hud?.racers.length || (captainDuel?2:6)}<small>{battleEvent?'BATTLE CAREER':captainDuel?'CAPTAIN DUEL':hud?.timeTrial?'TIME TRIAL':'POSITION'}</small></span></div>
            <div className="rr-lap"><span>LAP <b>{hud?.lap || 1}</b> / 3</span><time aria-label="Current lap time">{formatTime(hud?.lapTime || 0)}</time>{!!hud?.bestLap && <small>BEST {formatTime(hud.bestLap)}</small>}</div>
            <button className="kr-icon" aria-label="Pause menu" onClick={()=>setModal('pause')}><Pause size={22}/></button>
          </div>
          <div className="rr-map"><CircuitMap id={trackId} frame={hud}/></div>
          <button className="rr-camera" aria-label={`Switch to ${cameraMode==='driver'?'chase':'driver'} camera`} onClick={()=>setCameraMode(v=>v==='driver'?'chase':'driver')}><Camera size={18}/></button>
          <button className="rr-recover" aria-label="Recover kart on track" {...touch('recover',true)}><RotateCcw size={18}/></button>
          {(hud?.countdown || 0)>0 && <div className="rr-countdown" role="status"><div className="rr-start-lights" aria-hidden="true">{[3,2,1].map(n=><i key={n} className={hud!.countdown<=n?'on':''}/>)}</div><span>READY TO RACE</span><b>{hud!.countdown}</b><p>Hold GAS to accelerate.<br/>Drag the left joystick to steer; slide it up to drift. Collect rockets, shields and boosts on track.</p></div>}
          {notice && <div className="rr-notice" role="status"><WifiOff size={16}/>{notice}</div>}
          <div className="rr-speed"><b>{hud?.reversing&&<small>R </small>}{Math.round(Math.abs(hud?.speed||0)*3.6)}</b><span>KM/H</span><RaceRevBar frame={hud}/></div>
          {!hud?.combat&&<RaceTelemetryHud frame={hud}/>}
          {hud?.combat&&<>
            <div className="rr-combat-hud" aria-label="Combat status"><strong>COMBAT RACE</strong><span>{Math.ceil(hud.health)}% CONDITION · {hud.combat.player.kills} DISABLED · {hud.combat.player.score} PTS</span><span>{hud.combat.player.reload>0?`RELOAD ${hud.combat.player.reload.toFixed(1)}s`:`AMMO ${hud.combat.player.ammo} / ${hud.combat.player.reserve}`}</span>{hud.combat.warnings.some(w=>w.targetId===hud.playerId)&&<span className="rr-incoming">INCOMING · STEER CLEAR OR SHIELD</span>}</div>
            <CombatControls disabled={!!modal} reloading={hud.combat.player.reload>0} shield={hud.combat.player.shield} shieldActive={hud.combat.player.shieldActive} pulseCooldown={hud.combat.player.pulseCooldown} disrupted={hud.combat.player.disrupted>0}
              hold={(id,key,value)=>{if(modalRef.current)return;audio.current?.unlock();if(key==='pulse'){if(value===true)engine.current?.queueCombatPulse();return;}if(key==='reload'){combatHeld.current.hold(id,'reload',value);if(value===true)engine.current?.queueCombatReload();}else heldInput.current.hold(id,key,value);if(engine.current){Object.assign(engine.current.input,heldInput.current.read());engine.current.combatInput.reload=combatHeld.current.read().reload;}}}
              release={id=>{heldInput.current.release(id);combatHeld.current.release(id);if(engine.current){Object.assign(engine.current.input,heldInput.current.read());engine.current.combatInput.reload=combatHeld.current.read().reload;}}}/>
          </>}
          <KartControls raceItem={hud?.raceItem} itemShield={hud?.itemShield} boost={hud?.boost||0} drifting={hud?.drifting} driftCharge={hud?.driftCharge} turbo={hud?.turbo} boostEvent={hud?.boostEvent} reversing={hud?.reversing} disabled={!!modal}
            hold={(id,key,value)=>{audio.current?.unlock();heldInput.current.hold(id,key,value);if(engine.current)Object.assign(engine.current.input,heldInput.current.read());}}
            release={id=>{heldInput.current.release(id);if(engine.current)Object.assign(engine.current.input,heldInput.current.read());}}/>
          <div className="rr-key-hint">{hud?.combat?'F FIRE · Q SHIELD · R RELOAD · E EMP · ↑ GAS · ← → STEER':'↑ GAS · ← → STEER · SPACE DRIFT · SHIFT BOOST · E USE PICKUP · HOLD ↓ BRAKE / REVERSE'}</div>
        </div>
      )}
      {screen === 'results' && result && (
        <div className="kr-results-backdrop">
          <section className="kr-results">
            <div className="kr-eyebrow">
              <Flag size={16} /> {duelResult?'ALI DEMI CAPTAIN DUEL':result.combat?'COMBAT RACE COMPLETE':result.timeTrial?'TIME TRIAL COMPLETE':'RACE COMPLETE'}
            </div>
            <div className="kr-finish-place">
              {duelOutcome==='tie'?'TIE':result.timeTrial && !session?'TT':finishedMe?.finished || rankedTrial ? String(place).padStart(2, '0') : 'DNF'}
              <span>
                {battleEvent?(battlePassed?'VIJA E PARË COMPLETE.':battleComplete?'VIJA E PARË REPLAY.':'REACH THE PODIUM.'):duelOutcome?(duelOutcome==='win'?'VICTORY':duelOutcome==='loss'?'CAPTAIN WINS':duelOutcome==='tie'?'DEAD HEAT':'DUEL UNFINISHED'):result.timeTrial?(session?'FASTEST LAP CHALLENGE':'PERSONAL BEST CHALLENGE'):finishedMe?.finished
                  ? place === 1
                    ? 'VICTORY'
                    : 'FINISH POSITION'
                  : finishedMe?.retired
                    ? 'KART RETIRED'
                    : 'RACE ENDED'}
              </span>
            </div>
            <h2>
              {duelOutcome?(duelOutcome==='win'?'CAPTAIN BEATEN.':duelOutcome==='tie'?'SIDE BY SIDE.':duelOutcome==='loss'?'THE CAPTAIN TAKES IT.':'TRY THE DUEL AGAIN.'):result.timeTrial?(session ? (finishedMe && Number.isFinite(bestTrialLap(finishedMe)) ? (place===1?'FASTEST LAP.':'YOUR NEXT LAP AWAITS.') : 'NO VALID LAP RECORDED.') : result.newBest?'A NEW BENCHMARK.':'FIND YOUR NEXT TENTH.') : place === 1 && finishedMe?.finished
                ? 'THE STREETS ARE YOURS.'
                : 'ONE MORE LAP? ONE MORE RACE.'}
            </h2>
            <p>
              {TRACKS.find((t) => t.id === normalizeTrack(result.trackId))?.name} ·{' '}
              {formatTime(finishedMe?.finishTime || result.elapsed)}
            </p>
            {duelResult&&<p className="kr-notice">Solo practice against {CAPTAIN_NAME}. No credits, stakes or career record.</p>}
            {battleEvent&&<p className="kr-notice" role="status">
              {battleXp>0?`+${battleXp} Battle XP saved on this device.`:!saved?'Battle XP could not be saved.':battleComplete?'Already completed. Replays do not award extra XP.':'Finish in the top three at Brryli to earn Battle XP.'}
            </p>}
            <RaceDebrief result={result}/>
            {result.combat&&<div className="rr-action-summary"><b>{result.combat.player.kills} rival karts disabled · {result.combat.player.hits} hits · {result.combat.player.score||0} points</b><p>{result.combat.player.supplies||0} supply pickups collected. Combat races do not award championship credits or TPG.</p></div>}
            <div className="kr-result-table">
              {result.racers.map((r, i) => (
                <div
                  key={r.id}
                  className={r.id === result.playerId ? 'you' : ''}
                >
                  <span>{duelOutcome==='tie'?'T-1':String(i + 1).padStart(2, '0')}</span>
                  <b>{r.name}</b>
                  <small>
                    {r.ai ? 'AI' : r.id === result.playerId ? 'YOU' : 'PLAYER'}
                  </small>
                  <span>
                    {result.timeTrial && session ? (Number.isFinite(bestTrialLap(r)) ? formatTime(bestTrialLap(r)) : 'NO VALID LAP') : r.finished
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
                <button className="kr-start" onClick={()=>start(!!duelResult,battleEvent)}>
                  <RotateCcw size={20} /> {battleEvent?'RETRY BATTLE':duelResult?'REMATCH CAPTAIN':'RACE AGAIN'} <ArrowRight size={20} />
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
            <div className="kr-eyebrow">TIRANA RACING STREETS</div>
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
                  Race achievements stay on this device.
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
                    Your driver is Turi, using the original user-supplied Tirana Streets character. Adapted for TonPlaygram. Tirana geography:{' '}
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
                    Hold GAS to accelerate; release it to coast. Use left and right to
                    steer. Brake before tight corners.
                  </p>
                  <b>02 · Turn a drift into speed.</b>
                  <p>
                    Hold DRIFT while steering. Charge the meter, then release
                    for a short turbo. With two thumbs, keep GAS held and slide
                    your steering thumb upward to drift; slide it back down to release.
                  </p>
                  <b>03 · Make your move.</b>
                  <p>
                    Hold BOOST on straights, or slide your gas thumb upward to boost.
                    Charge blue, gold or violet drift sparks,
                    then release DRIFT for a stronger turbo. Complete three ordered laps.
                    Bumps slow you down; your kart stays in the race.
                  </p>
                  <b>04 · Find extra speed.</b>
                  <p>
                    Four sector splits show where you gain time. Recovering invalidates that lap. Follow another kart to charge a slipstream boost. Cross the cyan
                    boost strips for turbo and extra boost energy. Collect orange rockets, blue shields and green boosts. Hold one pickup at a time; tap its button or press E to use it. Rockets slow rivals without eliminating them; shields last four seconds.
                  </p>
                </div>
                <p>
                  Keyboard: arrows or A/D to steer, Space to drift, Shift to
                  boost, E to use your pickup, and hold the down arrow to brake, then reverse after stopping. Tap the reset arrow if you get stuck.
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
