import { nearestShop } from './shared/cityPopulation.mjs';
"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  ChevronRight,
  Compass,
  Flag,
  Footprints,
  Gauge,
  HelpCircle,
  LockKeyhole,
  Map,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SunMedium,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  advanceState,
  control,
  createState,
  emptyInput,
  freshCareer,
  interact,
  MISSIONS,
  FREE_ROAM,
  movePlayer,
  navigation,
  WORLD,
  type Career,
  type State,
  type Point,
} from "./shared/engine.mjs";
import type { Snapshot } from "./shared/rooms.mjs";
import { CityConnection, httpTransport, type Transport } from "./network";
import { CityInput } from "./input";
import { CityAudio } from "./audio";
import { Arsenal } from "./Arsenal";
import {
  DIFFICULTIES,
  WEAPON_BY_ID,
  difficultyOf,
  type Difficulty,
} from "./shared/weapons.mjs";
import { wantedStars } from "./shared/cityLife.mjs";
import type { CityRenderer } from "./renderer";
import "./city.css";

type Props = {
  playerName?: string;
  onExit?: () => void;
  transport?: Transport;
};
const MODES = [
  { id: "solo", label: "Explore + AI", icon: Compass },
  { id: "career", label: "Career", icon: Flag },
  { id: "online", label: "Online", icon: Users },
] as const;
const clock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(
    Math.max(0, seconds) % 60,
  )
    .toString()
    .padStart(2, "0")}`;
const nearestDistrict = (x = 0, z = 0) =>
  WORLD.landmarks.reduce(
    (nearest, landmark) => {
      const distance = Math.hypot(landmark.x - x, landmark.z - z);
      return distance < nearest.distance ? { name: landmark.name, distance } : nearest;
    },
    { name: "Central Tirana", distance: Number.POSITIVE_INFINITY },
  ).name;
const cityClock = (elapsed = 0) => {
  const minutes = (17 * 60 + 24 + Math.floor(elapsed / 3)) % (24 * 60);
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
};
function CityMap({
  player,
  state,
  route,
  large = false,
}: {
  player?: { x: number; z: number; heading: number };
  state: State | null;
  route: Point[];
  large?: boolean;
}) {
  const b = WORLD.bounds,
    view = large
      ? `${b[0]} ${b[1]} ${b[2] - b[0]} ${b[3] - b[1]}`
      : player
        ? `${player.x - 120} ${player.z - 120} 240 240`
        : "-150 0 300 300";
  const size = large ? 7 : 3.3;
  return (
    <div className={large ? "ts-map-large" : "ts-minimap"}>
      <svg
        viewBox={view}
        role="img"
        aria-label="Street map of central Tirana, north at the top"
      >
        <image
          href="/assets/tirana-streets/map.svg"
          x={b[0]}
          y={b[1]}
          width={b[2] - b[0]}
          height={b[3] - b[1]}
        />
        {route.length > 1 && (
          <polyline
            points={route.map((p) => `${p.x},${p.z}`).join(" ")}
            fill="none"
            stroke="#ddf67d"
            strokeWidth={large ? 5 : 3}
            strokeLinejoin="round"
          />
        )}
        {state &&
          state.cars
            .filter((c) => !c.driver)
            .map((c) => (
              <rect
                key={c.id}
                x={c.x - size}
                y={c.z - size * 1.7}
                width={size * 2}
                height={size * 3.4}
                fill="#82c9d3"
              />
            ))}
        {state &&
          Object.values(state.players).map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.z}
              r={size * 1.5}
              fill="#ff8b5d"
            />
          ))}
        {state && (
          <g>
            <rect
              x={state.shop.x - size * 2}
              y={state.shop.z - size * 2}
              width={size * 4}
              height={size * 4}
              fill="#d2f566"
              stroke="#14291f"
              strokeWidth="1"
            />
            {large && (
              <text
                x={state.shop.x + 15}
                y={state.shop.z - 12}
                fontSize="18"
                fill="#d2f566"
              >
                Arben · Arsenal
              </text>
            )}
            {state.units.map((u) => (
              <circle
                key={u.id}
                cx={u.x}
                cy={u.z}
                r={size * 1.8}
                fill={u.model === "military-suv" ? "#e0ac59" : "#60adff"}
              />
            ))}
            {state.npcs
              .filter((n) => n.kind === "gang" && n.health > 0)
              .map((n) => (
                <circle
                  key={n.id}
                  cx={n.x}
                  cy={n.z}
                  r={size * 1.4}
                  fill="#f77b6a"
                />
              ))}
          </g>
        )}
        {player && (
          <g
            transform={`translate(${player.x} ${player.z}) rotate(${(-player.heading * 180) / Math.PI})`}
          >
            <circle r={size * 3} fill="#ddf67d" opacity=".25" />
            <path
              d={`M 0 ${-size * 2.5} L ${size * 1.6} ${size * 2} L 0 ${size} L ${-size * 1.6} ${size * 2} Z`}
              fill="#f2ffcd"
              stroke="#12282f"
              strokeWidth="1"
            />
          </g>
        )}
        {large &&
          WORLD.landmarks.map((p) => (
            <g key={p.id}>
              <circle cx={p.x} cy={p.z} r="8" fill="#ff8b5d" />
              <text x={p.x + 14} y={p.z + 5} fontSize="19" fill="#eef5e9">
                {p.name}
              </text>
            </g>
          ))}
      </svg>
      <span className="ts-north">N</span>
    </div>
  );
}

export default function CityGame({
  playerName = "Driver",
  onExit,
  transport = httpTransport,
}: Props) {
  const mount = useRef<HTMLDivElement>(null),
    renderer = useRef<CityRenderer | null>(null),
    input = useRef<CityInput | null>(null),
    audio = useRef<CityAudio | null>(null),
    connection = useRef<CityConnection | null>(null);
  const engine = useRef<State | null>(null),
    identity = useRef("local"),
    screenRef = useRef("lobby"),
    overlayRef = useRef<string | null>(null),
    alive = useRef(true),
    requestGeneration = useRef(0),
    transportRef = useRef(transport),
    routeRef = useRef<Point[]>([]);
  transportRef.current = transport;
  const [screen, setScreenState] = useState("lobby"),
    [overlay, setOverlayState] = useState<string | null>(null),
    [mode, setMode] = useState<"solo" | "career" | "online">("solo"),
    [missionId, setMissionId] = useState("free-roam"),
    [crewMode, setCrewMode] = useState("rivals"),
    [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState("Preparing central Tirana"),
    [fatal, setFatal] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [networkError, setNetworkError] = useState("");
  const [career, setCareer] = useState<Career>(freshCareer),
    [profileLoaded, setProfileLoaded] = useState(false),
    [activeRoom, setActiveRoom] = useState<string | null>(null),
    [room, setRoom] = useState<Snapshot | null>(null),
    [roomCode, setRoomCode] = useState("");
  const [view, setView] = useState<State | null>(null),
    [fps, setFps] = useState(60),
    [quality, setQuality] = useState<"auto" | "high" | "battery">("auto"),
    [sound, setSound] = useState(true),
    [stick, setStick] = useState({ x: 0, y: 0 }),
    [copied, setCopied] = useState(false);
  const modal = useRef<HTMLElement | null>(null);
  const mission =
      view?.missionId === "free-roam"
        ? FREE_ROAM
        : MISSIONS.find((m) => m.id === (view?.missionId || missionId)) ||
          MISSIONS[0],
    selected =
      missionId === "free-roam"
        ? FREE_ROAM
        : MISSIONS.find((m) => m.id === missionId) || MISSIONS[0],
    player = view?.players[identity.current],
    driving = !!player?.carId,
    flying = !!player?.aircraftId,
    helicopterNearby = !!(
      player &&
      view?.helicopter &&
      Math.hypot(player.x - view.helicopter.stairX, player.z - view.helicopter.stairZ) < 12
    ),
    district = nearestDistrict(player?.x, player?.z),
    streetPopulation = view?.npcs.filter((npc) => npc.health > 0).length || 0,
    activeTraffic = (view?.traffic.length || 0) + (view?.cars.length || 0);
  const setScreen = (v: string) => {
    screenRef.current = v;
    setScreenState(v);
  };
  const setOverlay = (v: string | null) => {
    overlayRef.current = v;
    setOverlayState(v);
    input.current?.clear();
    input.current?.setEnabled(!v && screenRef.current === "playing");
    setStick({ x: 0, y: 0 });
  };
  const receive = (snapshot: Snapshot, saved?: Career) => {
    if (!alive.current) return;
    identity.current = snapshot.playerId;
    setRoom(snapshot);
    setActiveRoom(snapshot.id);
    if (saved) setCareer(saved);
    if (snapshot.state) {
      for (const p of Object.values(snapshot.state.players)) {
        p.input = emptyInput();
        p.inputAt = snapshot.state.elapsed;
        p.lastAction = 0;
      }
      if (
        snapshot.phase === "finished" &&
        (snapshot.mode !== "career" ||
          snapshot.state.players[snapshot.playerId]?.failed ||
          saved?.completed.includes(snapshot.missionId))
      )
        connection.current?.stop();
      engine.current = snapshot.state;
      if (snapshot.phase === "active" || snapshot.phase === "finished") {
        setScreen("playing");
        input.current?.setEnabled(!overlayRef.current);
      }
    }
  };
  const sendAction = (action: string) => {
    if (connection.current) connection.current.interact(action);
    else if (engine.current) {
      // Local menus pause simulation; actions still use simulation cooldowns.
      interact(engine.current, identity.current, action);
      setView({ ...engine.current, players: { ...engine.current.players } });
    }
  };
  const actionRef = useRef<(action: string) => void>(() => {});
  actionRef.current = (action) => {
    if (action === "arsenal") {
      setOverlay("arsenal");
      return;
    }
    if (action === "pause") {
      setOverlay(overlayRef.current ? null : "pause");
      return;
    }
    if (screenRef.current !== "playing" || overlayRef.current) return;
    sendAction(action);
  };

  useEffect(() => {
    if (!overlay) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],select,input,[tabindex="0"]',
        ) || [],
      );
    focusables()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOverlay(null);
      }
      if (e.key === "Tab") {
        const items = focusables(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [overlay]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false,
      frame = 0,
      previous = performance.now(),
      uiTime = 0,
      routeTime = 0,
      lastIndex = -1,
      lastRoute = { x: Infinity, z: Infinity };
    const inputs = new CityInput((a) => actionRef.current(a));
    input.current = inputs;
    inputs.setEnabled(false);
    audio.current = new CityAudio();
    engine.current = createState(
      [{ id: "local", name: playerName }],
      MISSIONS[0].id,
    );
    void import("./renderer").then(async ({ CityRenderer }) => {
      if (cancelled || !alive.current || !mount.current) return;
      try {
        const city = new CityRenderer(mount.current);
        renderer.current = city;
        const draw = (now: number) => {
          if (cancelled || !alive.current) return;
          const dt = Math.min(0.05, (now - previous) / 1000);
          previous = now;
          uiTime += dt;
          routeTime += dt;
          const state = engine.current,
            p = state?.players[identity.current],
            playing = screenRef.current === "playing";
          if (state && playing && p) {
            const controls = inputs.read(city.yaw, !!p.carId);
            control(state, p.id, controls);
            connection.current?.controls(controls);
            if (connection.current) {
              if (!overlayRef.current && state.phase === "active") {
                state.elapsed += dt;
                movePlayer(state, p, dt);
              }
            } else if (!overlayRef.current) advanceState(state, dt);
            if (
              routeTime > 0.9 &&
              (p.index !== lastIndex ||
                Math.hypot(p.x - lastRoute.x, p.z - lastRoute.z) > 12)
            ) {
              routeRef.current = navigation(state, p.id);
              city.setRoute(routeRef.current);
              lastRoute = { x: p.x, z: p.z };
              routeTime = 0;
              if (lastIndex >= 0 && p.index > lastIndex)
                audio.current?.cue(true);
              lastIndex = p.index;
            }
            audio.current?.update(p.speed, !!p.carId && !overlayRef.current);
            if (!overlayRef.current) audio.current?.city(state, p, dt);
          } else audio.current?.update(0, false);
          city.render(state, identity.current, dt, !playing);
          if (uiTime > 0.1) {
            uiTime = 0;
            setView(state ? { ...state, players: { ...state.players } } : null);
            setFps(city.fps);
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        await city.load((message) => {
          if (!cancelled && alive.current) setLoading(message);
        });
        if (!cancelled && alive.current) setReady(true);
      } catch (e) {
        if (!cancelled && alive.current)
          setFatal(e instanceof Error ? e.message : "WebGL could not start.");
      }
    });
    void transportRef
      .current("profile")
      .then((r) => {
        if (cancelled || !alive.current) return;
        if (r.career) setCareer(r.career);
        setActiveRoom(r.activeRoom || null);
        setProfileLoaded(true);
      })
      .catch((e) => {
        if (!cancelled && alive.current) {
          setError(e.message);
          setProfileLoaded(false);
        }
      });
    return () => {
      cancelled = true;
      alive.current = false;
      requestGeneration.current++;
      cancelAnimationFrame(frame);
      inputs.destroy();
      renderer.current?.destroy();
      audio.current?.destroy();
      connection.current?.stop();
    };
  }, []);

  const connect = (
    snapshot: Snapshot,
    c?: Career,
    generation = requestGeneration.current,
  ) => {
    if (!alive.current || generation !== requestGeneration.current) {
      void transportRef
        .current("leave", { roomId: snapshot.id })
        .catch(() => {});
      return;
    }
    connection.current?.stop();
    receive(snapshot, c);
    const ctn = new CityConnection(
      (a, p) => transportRef.current(a, p),
      snapshot.id,
      receive,
      setNetworkError,
    );
    connection.current = ctn;
    ctn.start();
    if (snapshot.phase === "waiting") setScreen("crew");
  };
  async function runRequest(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      void transportRef
        .current("profile")
        .then((r) => {
          if (alive.current) {
            setActiveRoom(r.activeRoom || null);
            if (r.career) setCareer(r.career);
            setProfileLoaded(true);
          }
        })
        .catch(() => {});
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function launch() {
    void audio.current?.unlock();
    if (mode === "solo") {
      identity.current = "local";
      connection.current?.stop();
      connection.current = null;
      setRoom(null);
      engine.current = createState(
        [{ id: "local", name: playerName }],
        missionId,
        "solo",
        career.completed.length >= 3,
        difficulty,
      );
      setView(engine.current);
      setScreen("playing");
      setOverlay(null);
      renderer.current!.yaw = engine.current.players.local.heading;
      renderer.current?.setRoute([]);
      routeRef.current = [];
      return;
    }
    const generation = ++requestGeneration.current;
    await runRequest(async () => {
      const response = await transportRef.current("create", {
        mode: mode === "career" ? "career" : crewMode,
        missionId,
        difficulty,
      });
      if (!response.room)
        throw Error("The city room did not open. Please retry.");
      if (!alive.current || generation !== requestGeneration.current) {
        void transportRef.current("leave", { roomId: response.room.id });
        return;
      }
      connect(response.room, response.career);
      if (response.room.state)
        renderer.current!.yaw =
          response.room.state.players[response.room.playerId].heading;
    });
  }
  async function join(code = roomCode) {
    const generation = ++requestGeneration.current;
    void audio.current?.unlock();
    await runRequest(async () => {
      const r = await transportRef.current("join", {
        roomId: code.trim().toUpperCase(),
      });
      if (r.room) connect(r.room, r.career, generation);
    });
  }
  async function quickJoin() {
    const generation = ++requestGeneration.current;
    await runRequest(async () => {
      const list = await transportRef.current("list");
      if (!alive.current || generation !== requestGeneration.current) return;
      const open = list.rooms?.find((r) => r.mode === crewMode);
      if (open) {
        const r = await transportRef.current("join", { roomId: open.id });
        if (r.room) connect(r.room, r.career, generation);
      } else {
        const r = await transportRef.current("create", {
          mode: crewMode,
          missionId,
          difficulty,
        });
        if (r.room) connect(r.room, r.career, generation);
      }
    });
  }
  async function leave() {
    requestGeneration.current++;
    input.current?.clear();
    connection.current?.controls(emptyInput());
    const id = connection.current?.roomId;
    connection.current?.stop();
    connection.current = null;
    if (id) {
      try {
        const r = await transportRef.current("leave", { roomId: id });
        if (r.career) setCareer(r.career);
        setActiveRoom(null);
      } catch (e) {
        setError(
          "The room will release your seat shortly. You can resume it from the lobby.",
        );
        setActiveRoom(id);
      }
    }
    setRoom(null);
    setNetworkError("");
    setOverlay(null);
    setScreen("lobby");
    input.current?.setEnabled(false);
    engine.current = createState(
      [{ id: "local", name: playerName }],
      missionId,
    );
    identity.current = "local";
  }
  const joystick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!input.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - rect.left - rect.width / 2) / 42,
      y = (e.clientY - rect.top - rect.height / 2) / 42;
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    input.current.touch.x = x;
    input.current.touch.y = -y;
    setStick({ x: x * 34, y: y * 34 });
  };
  const resetStick = () => {
    if (input.current) {
      input.current.touch.x = 0;
      input.current.touch.y = 0;
    }
    setStick({ x: 0, y: 0 });
  };
  const hold = (
    key: "gas" | "fast" | "brake" | "fire",
    value: number | boolean,
  ) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (input.current) (input.current.touch[key] as number | boolean) = value;
    },
    onPointerUp: () => {
      if (input.current)
        (input.current.touch[key] as number | boolean) =
          typeof value === "number" ? 0 : false;
    },
    onPointerCancel: () => {
      if (input.current)
        (input.current.touch[key] as number | boolean) =
          typeof value === "number" ? 0 : false;
    },
    onLostPointerCapture: () => {
      if (input.current)
        (input.current.touch[key] as number | boolean) =
          typeof value === "number" ? 0 : false;
    },
  });
  const cameraPointer = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  const readyCount = room?.members.filter((m) => m.ready).length || 0;
  const result =
    player && (player.finished || player.failed || view?.phase === "finished");

  return (
    <main className="ts-game" aria-label="Tirana Streets game">
      <div className="ts-world" ref={mount} />
      {screen !== "playing" && <div className="ts-vignette" />}
      {screen !== "playing" && (
        <header className="ts-brand">
          {onExit ? (
            <button
              className="ts-emblem"
              onClick={onExit}
              aria-label="Back to Games"
            >
              <ArrowLeft size={21} />
            </button>
          ) : (
            <span className="ts-emblem">
              <Compass size={22} />
            </span>
          )}
          <div>
            TIRANA<span>STREETS</span>
          </div>
          <small>ALBANIA · 41.3275° N</small>
          <button
            className="ts-icon"
            onClick={() => setOverlay("settings")}
            aria-label="Settings"
          >
            <Settings2 size={19} />
          </button>
        </header>
      )}
      {screen === "lobby" && (
        <section className="ts-lobby">
          <p className="ts-eyebrow">
            <span /> CENTRAL TIRANA · GOLDEN HOUR
          </p>
          <h1>
            THE CITY.
            <br />
            <em>YOUR STORY.</em>
          </h1>
          <p className="ts-intro">
            From Skanderbeg Square to Blloku. Find your ride, take a job and
            make a name for yourself.
          </p>
          <div className="ts-city-pulse" aria-label="Live city simulation">
            <span><SunMedium size={15} /><b>17:24</b><small>GOLDEN HOUR</small></span>
            <span><CarFront size={15} /><b>LIVE</b><small>TRAFFIC</small></span>
            <span><Footprints size={15} /><b>ACTIVE</b><small>CITY LIFE</small></span>
          </div>
          <div className="ts-modes" role="tablist" aria-label="Game mode">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setError("");
                  if (id === "career")
                    setMissionId(
                      MISSIONS[
                        Math.min(career.completed.length, MISSIONS.length - 1)
                      ].id,
                    );
                  else if (id === "online" && missionId === "free-roam")
                    setMissionId(MISSIONS[0].id);
                }}
                className={mode === id ? "selected" : ""}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {mode === "career" && (
            <div className="ts-career-summary">
              <Flag size={17} />
              <span>
                {career.completed.length}/{MISSIONS.length} chapters
              </span>
              <strong>{career.credits} REP</strong>
              <span>
                {career.completed.length >= 3
                  ? "Sports car unlocked"
                  : "Sports car at chapter 3"}
              </span>
            </div>
          )}
          <div className="ts-job-select">
            <div>
              <span>{mode === "career" ? "CAREER CHAPTER" : "CITY JOB"}</span>
              <select
                aria-label="Choose mission"
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
              >
                {mode === "solo" && (
                  <option value="free-roam">Free roam · No timer</option>
                )}
                {MISSIONS.map((m, i) => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={mode === "career" && i > career.completed.length}
                  >
                    {i + 1}. {m.title}
                    {mode === "career" && i > career.completed.length
                      ? " · Locked"
                      : ""}
                    {career.completed.includes(m.id) ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </div>
            <span className="ts-job-kind">
              {selected.type === "free"
                ? "OPEN CITY"
                : selected.type === "race"
                  ? "VS ARDI"
                  : selected.type === "pursuit"
                    ? "AI PURSUIT"
                    : selected.type === "combat"
                      ? "ARMED CREW"
                      : "COURIER"}
              <ChevronRight size={17} />
            </span>
          </div>
          <div
            className="ts-difficulty"
            role="group"
            aria-label="Mission difficulty"
          >
            {(
              Object.entries(DIFFICULTIES) as [
                Difficulty,
                typeof DIFFICULTIES.normal,
              ][]
            ).map(([id, cfg]) => (
              <button
                key={id}
                className={difficulty === id ? "active" : ""}
                aria-pressed={difficulty === id}
                onClick={() => setDifficulty(id)}
              >
                {cfg.label}
              </button>
            ))}
            <small>
              {selected.stars
                ? `${selected.stars}★ starting pursuit`
                : "No starting pursuit"}
            </small>
          </div>
          {mode === "online" && (
            <div className="ts-online-options">
              <div className="ts-segment">
                <button
                  className={crewMode === "rivals" ? "active" : ""}
                  onClick={() => setCrewMode("rivals")}
                >
                  Rivals
                </button>
                <button
                  className={crewMode === "coop" ? "active" : ""}
                  onClick={() => setCrewMode("coop")}
                >
                  Co-op crew
                </button>
              </div>
              <div className="ts-code">
                <input
                  aria-label="Room code"
                  placeholder="ROOM CODE"
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
                <button
                  disabled={busy || roomCode.trim().length !== 6}
                  onClick={() => void join()}
                >
                  Join <ArrowRight size={16} />
                </button>
                <button
                  disabled={busy || !profileLoaded}
                  onClick={() => void quickJoin()}
                  aria-label="Find an open crew"
                >
                  <Radio size={19} />
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="ts-error" role="alert">
              {error}
            </p>
          )}
          {!profileLoaded && mode !== "solo" && (
            <button
              className="ts-text-button"
              disabled={busy}
              onClick={() =>
                void runRequest(async () => {
                  const r = await transportRef.current("profile");
                  if (r.career) setCareer(r.career);
                  setActiveRoom(r.activeRoom || null);
                  setProfileLoaded(true);
                })
              }
            >
              Reconnect to career and online
            </button>
          )}
          {activeRoom && (
            <div className="ts-resume">
              <span>Your city session is waiting.</span>
              <button disabled={busy} onClick={() => void join(activeRoom)}>
                Resume
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void runRequest(async () => {
                    await transportRef.current("leave", { roomId: activeRoom });
                    setActiveRoom(null);
                  })
                }
              >
                Leave
              </button>
            </div>
          )}
          <button
            className="ts-primary"
            disabled={
              !ready ||
              busy ||
              (mode !== "solo" && (!profileLoaded || !!activeRoom))
            }
            onClick={() => void launch()}
          >
            <CarFront size={22} />
            {busy
              ? "CONNECTING…"
              : !ready
                ? loading
                : mode === "online"
                  ? "CREATE CITY ROOM"
                  : mode === "career"
                    ? "CONTINUE YOUR STORY"
                    : "ENTER TIRANA"}
            <ArrowUpRight size={22} />
          </button>
          <div className="ts-lobby-foot">
            <button onClick={() => setOverlay("help")}>TOUCH + KEYBOARD</button>
            <button onClick={() => setOverlay("credits")}>
              CITY + ASSET CREDITS
            </button>
          </div>
        </section>
      )}
      {screen === "crew" && room && (
        <section className="ts-crew-panel">
          <p className="ts-eyebrow">
            <span /> YOUR CITY LOBBY
          </p>
          <h1>
            BRING YOUR
            <br />
            <em>CREW.</em>
          </h1>
          <div className="ts-room-code">
            <span>ROOM CODE</span>
            <button
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(room.id)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => setError("Select and copy the room code."));
              }}
            >
              {room.id}
              {copied ? <Check size={20} /> : <Users size={20} />}
            </button>
          </div>
          <p>
            {room.mode === "coop"
              ? "Complete deliveries together."
              : "Compete to finish the city job first."}{" "}
            Up to four players.
          </p>
          <ul className="ts-members">
            {room.members.map((m) => (
              <li key={m.id}>
                <span className="ts-avatar">{m.name.slice(0, 1)}</span>
                <span>
                  {m.name}
                  {m.id === room.host && <small> HOST</small>}
                  {m.id === room.playerId && <small> · YOU</small>}
                </span>
                <span className={m.ready ? "ts-ready" : ""}>
                  {!m.connected
                    ? "Reconnecting"
                    : m.ready
                      ? "Ready"
                      : "Getting ready"}
                </span>
              </li>
            ))}
          </ul>
          <p className="ts-crew-count">
            {room.members.length}/4 players · {readyCount} ready ·{" "}
            {MISSIONS.find((m) => m.id === room.missionId)?.title}
          </p>
          {room.members.length < 2 && (
            <p className="ts-muted">
              Share the room code with a friend who can open this game.
            </p>
          )}
          {error && (
            <p className="ts-error" role="alert">
              {error}
            </p>
          )}
          {networkError && (
            <p className="ts-error" role="status">
              {networkError}
            </p>
          )}
          <button
            className="ts-primary"
            disabled={busy}
            onClick={() =>
              void runRequest(async () => {
                if (room.host === room.playerId)
                  await connection.current?.command("start");
                else
                  await connection.current?.command("ready", {
                    ready: !room.members.find((m) => m.id === room.playerId)
                      ?.ready,
                  });
              })
            }
          >
            {room.host === room.playerId
              ? "START CITY RUN"
              : room.members.find((m) => m.id === room.playerId)?.ready
                ? "NOT READY"
                : "I’M READY"}
            <ArrowRight size={20} />
          </button>
          <button className="ts-text-button" onClick={() => void leave()}>
            Leave lobby
          </button>
        </section>
      )}
      {screen === "playing" && player && (
        <>
          <div
            className="ts-camera-zone"
            aria-label="Drag to look around"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              cameraPointer.current = {
                id: e.pointerId,
                x: e.clientX,
                y: e.clientY,
              };
            }}
            onPointerMove={(e) => {
              const p = cameraPointer.current;
              if (p?.id !== e.pointerId) return;
              renderer.current?.orbit(e.clientX - p.x, e.clientY - p.y);
              p.x = e.clientX;
              p.y = e.clientY;
            }}
            onPointerUp={() => {
              cameraPointer.current = null;
            }}
            onPointerCancel={() => {
              cameraPointer.current = null;
            }}
          />
          <header className="ts-hud-header">
            <button
              className="ts-icon"
              aria-label="Pause menu"
              onClick={() => setOverlay("pause")}
            >
              <Pause size={20} />
            </button>
            <div>
              <small>
                {room
                  ? room.mode === "career"
                    ? "CAREER"
                    : `${room.mode.toUpperCase()} · ${room.id}`
                  : "EXPLORE + AI"}
              </small>
              <strong>{mission.title}</strong>
            </div>
            <button
              className="ts-performance"
              onClick={() => setOverlay("settings")}
              aria-label="Graphics settings"
            >
              <i />
              {fps}
              <small>FPS</small>
            </button>
          </header>
          <div className="ts-objective">
            <span className="ts-objective-icon">
              <Flag size={18} />
            </span>
            <div>
              <small>
                {mission.type === "free"
                  ? "FREE ROAM · NO TIMER"
                  : `${Math.min(player.index + 1, mission.stops.length)} / ${mission.stops.length} · ${mission.type === "delivery" ? "STOP TO DELIVER" : "REACH CHECKPOINT"}`}
              </small>
              <strong>
                {mission.type === "free"
                  ? "Explore central Tirana"
                  : mission.type === "combat" &&
                      (view?.objectiveRemaining ?? selected.enemies ?? 0) > 0
                    ? `${view?.objectiveRemaining ?? selected.enemies} armed rivals remaining`
                    : mission.stops[player.index]?.name || "Route complete"}
              </strong>
            </div>
            <span>
              {mission.type === "free" ? (
                <Compass size={19} />
              ) : (
                clock(
                  mission.time *
                    difficultyOf(view?.difficulty || difficulty).time -
                    (view?.elapsed || 0),
                )
              )}
            </span>
          </div>
          <button
            className="ts-map-button"
            onClick={() => setOverlay("map")}
            aria-label="Open city map"
          >
            <CityMap player={player} state={view} route={routeRef.current} />
            <span>
              <Map size={11} /> MAP
            </span>
          </button>
          <div className="ts-status-stack">
            <span className="ts-location"><MapPin size={13} /> {district}</span>
            <span className="ts-city-status">
              <SunMedium size={13} /> {cityClock(view?.elapsed)} · {activeTraffic} CARS · {streetPopulation} PEOPLE
            </span>
            {view?.rival && mission.type === "race" && (
              <span>
                <Flag size={13} /> ARDI {view.rival.index}/
                {mission.stops.length}
              </span>
            )}
            <span
              className={`ts-wanted ${player.searching ? "searching" : ""}`}
              aria-label={`${wantedStars(player.wanted)} wanted stars`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <b
                  key={n}
                  className={n <= wantedStars(player.wanted) ? "lit" : ""}
                >
                  ★
                </b>
              ))}
            </span>
            {player.wanted > 0 && (
              <span>
                {wantedStars(player.wanted) === 5
                  ? "MILITARY PURSUIT"
                  : player.searching
                    ? "SEARCHING · STAY OUT OF SIGHT"
                    : "POLICE PURSUIT"}
              </span>
            )}
            <span>
              HP {Math.ceil(player.health)} · ARMOR {Math.ceil(player.armor)}
            </span>
            {room && room.members.length > 1 && (
              <span>
                <Users size={13} /> {room.members.length} ONLINE
              </span>
            )}
          </div>
          {!driving && !result && (
            <>
              <div className="ts-crosshair" aria-hidden="true">
                +
              </div>
              <div className="ts-combat-controls">
                <button
                  className="ts-fire"
                  aria-label={flying ? "Hold to launch helicopter missiles" : "Hold to fire toward the camera aim"}
                  disabled={!player.weapon || player.health <= 0}
                  {...hold("fire", true)}
                >
                  {flying ? "MISSILE" : "FIRE"}
                </button>
                <button
                  onClick={() => actionRef.current("reload")}
                  aria-label="Reload weapon"
                >
                  RELOAD
                </button>
                <button onClick={() => setOverlay("arsenal")}>ARSENAL</button>
              </div>
              <div className="ts-ammo">
                <strong>
                  {WEAPON_BY_ID.get(player.weapon)?.label || "Unarmed"}
                </strong>
                <span>
                  {player.reloadAt
                    ? "RELOADING…"
                    : `${player.inventory[player.weapon]?.ammo ?? 0} / ${player.inventory[player.weapon]?.reserve ?? 0}`}
                </span>
              </div>
            </>
          )}
          {!result &&
            view &&
            Math.hypot(player.x - nearestShop(view,player).x, player.z - nearestShop(view,player).z) < 12 &&
            !driving && (
              <button
                className="ts-shop-prompt"
                onClick={() => setOverlay("arsenal")}
              >
                Talk to Arben · Weapon shop
              </button>
            )}
          {player.health <= 0 && !result && (
            <div className="ts-respawn">
              Regrouping… respawn in{" "}
              {Math.max(0, Math.ceil(player.respawnAt - (view?.elapsed || 0)))}s
            </div>
          )}
          {networkError && (
            <div className="ts-network-error" role="alert">
              {networkError} Controls will stop until the connection returns.
            </div>
          )}
          {!result && (
            <>
              <div className="ts-driving-hint">
                {driving ? (
                  mission.type === "free" ? (
                    "Explore the city. Open the map to find a landmark."
                  ) : mission.type === "delivery" ? (
                    "Brake inside the marker to deliver"
                  ) : (
                    "Follow the lime route"
                  )
                ) : (
                  <>
                    <CarFront size={16} /> Drag to aim · FIRE to shoot · Visit
                    Arben for equipment.
                  </>
                )}
              </div>
              <div
                className="ts-joystick"
                role="group"
                aria-label={driving ? "Steering joystick" : "Movement joystick"}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  joystick(e);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    joystick(e);
                }}
                onPointerUp={resetStick}
                onPointerCancel={resetStick}
                onLostPointerCapture={resetStick}
              >
                <div className="ts-stick-cross">+</div>
                <div
                  className="ts-stick"
                  style={{ transform: `translate(${stick.x}px,${stick.y}px)` }}
                />
                <span>{driving ? "STEER" : "MOVE"}</span>
              </div>
              <div className="ts-speed">
                <strong>
                  {driving ? (
                    Math.round(Math.abs(player.speed) * 3.6)
                  ) : (
                    <Footprints size={26} />
                  )}
                </strong>
                <small>{driving ? "KM/H" : "ON FOOT"}</small>
              </div>
              <div className="ts-actions">
                <button
                  className="ts-vehicle"
                  aria-label={
                    driving ? "Stop and exit car" : "Enter nearby car"
                  }
                  onClick={() => actionRef.current("vehicle")}
                  disabled={flying}
                >
                  <CarFront size={23} />
                  <small>{driving ? "EXIT" : "ENTER"}</small>
                </button>
                {(flying || helicopterNearby) && (
                  <button
                    className="ts-vehicle ts-helicopter"
                    aria-label={flying ? "Land and exit helicopter" : "Climb emergency stairs and take helicopter"}
                    onClick={() => actionRef.current("helicopter")}
                  >
                    <ArrowUpRight size={23} />
                    <small>{flying ? "LAND / EXIT" : "CLIMB / FLY"}</small>
                  </button>
                )}
                {flying ? (
                  <>
                    <button className="ts-gas" aria-label="Hold to lift helicopter higher" {...hold("fast", true)}>
                      <ArrowUpRight size={25} /><small>LIFT</small>
                    </button>
                    <button className="ts-brake" aria-label="Hold to lower helicopter" {...hold("brake", true)}>
                      <span>↓</span><small>LOWER</small>
                    </button>
                  </>
                ) : driving ? (
                  <>
                    <button
                      className="ts-gas"
                      aria-label="Hold to accelerate"
                      {...hold("gas", 1)}
                    >
                      <ChevronRight
                        size={29}
                        style={{ transform: "rotate(-90deg)" }}
                      />
                      <small>GAS</small>
                    </button>
                    <button
                      className="ts-brake"
                      aria-label="Hold to brake or reverse"
                      {...hold("gas", -1)}
                    >
                      <span>II</span>
                      <small>BRAKE</small>
                    </button>
                  </>
                ) : (
                  <button
                    className="ts-gas"
                    aria-label="Hold to sprint"
                    {...hold("fast", true)}
                  >
                    <Footprints size={24} />
                    <small>SPRINT</small>
                  </button>
                )}
              </div>
            </>
          )}

          {result && !overlay && (
            <section className="ts-result">
              <span className="ts-result-icon">
                {player.finished && !player.failed ? (
                  <Flag size={30} />
                ) : (
                  <RotateCcw size={30} />
                )}
              </span>
              <p className="ts-eyebrow">
                {player.finished && !player.failed
                  ? "JOB COMPLETE"
                  : "RUN ENDED"}
              </p>
              <h2>
                {player.finished && !player.failed
                  ? room?.mode === "rivals"
                    ? view?.winner === player.id
                      ? "YOU WON THE CITY RUN."
                      : "ROUTE COMPLETE."
                    : "A NAME IN THE CITY."
                  : "ANOTHER WAY THROUGH."}
              </h2>
              <p>{view?.message}</p>
              <div className="ts-result-stats">
                <span>
                  <strong>
                    {clock(player.finishTime || view?.elapsed || 0)}
                  </strong>
                  TIME
                </span>
                <span>
                  <strong>
                    {player.index}/{mission.stops.length}
                  </strong>
                  STOPS
                </span>
                <span>
                  <strong>
                    {room?.mode === "career"
                      ? career.credits
                      : player.finished
                        ? "✓"
                        : "—"}
                  </strong>
                  {room?.mode === "career" ? "CAREER REP" : "FINISHED"}
                </span>
              </div>
              {room?.mode === "career" && (
                <p className="ts-muted">
                  {career.completed.includes(mission.id)
                    ? "Chapter saved to your career."
                    : "Career result is syncing with the city service."}
                </p>
              )}
              <button className="ts-primary" onClick={() => void leave()}>
                BACK TO CITY LOBBY <ArrowRight size={20} />
              </button>
            </section>
          )}
        </>
      )}
      <a
        className="ts-map-credit"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
      {overlay && (
        <div
          className="ts-modal-backdrop"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <section
            ref={modal}
            className={`ts-modal ${overlay === "map" ? "ts-map-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={overlay}
          >
            <div className="ts-modal-title">
              <h2>
                {overlay === "pause"
                  ? "YOUR CITY. YOUR PACE."
                  : overlay === "settings"
                    ? "MAKE IT YOURS."
                    : overlay === "map"
                      ? "CENTRAL TIRANA"
                      : overlay === "arsenal"
                        ? "ARBEN’S ARSENAL"
                        : overlay === "credits"
                          ? "BUILT FROM OPEN ASSETS"
                          : "FIND YOUR WAY."}
              </h2>
              <button
                className="ts-icon"
                aria-label="Close menu"
                onClick={() => setOverlay(null)}
              >
                <X size={22} />
              </button>
            </div>
            {overlay === "arsenal" && player && view && (
              <Arsenal player={player} state={view} onAction={sendAction} />
            )}
            {overlay === "pause" && (
              <>
                <p>
                  {room
                    ? "Career and online mission clocks continue while this menu is open."
                    : "Your AI run is paused."}
                </p>
                <button className="ts-primary" onClick={() => setOverlay(null)}>
                  <Play size={18} /> KEEP EXPLORING <ArrowRight size={18} />
                </button>
                <button
                  className="ts-menu-row"
                  onClick={() => setOverlay("map")}
                >
                  <Map size={19} /> City map <ChevronRight size={18} />
                </button>
                <button
                  className="ts-menu-row"
                  onClick={() => setOverlay("settings")}
                >
                  <Settings2 size={19} /> Settings <ChevronRight size={18} />
                </button>
                <button
                  className="ts-menu-row"
                  onClick={() => setOverlay("help")}
                >
                  <HelpCircle size={19} /> Controls <ChevronRight size={18} />
                </button>
                <button
                  className="ts-menu-row"
                  onClick={() => {
                    setOverlay(null);
                    actionRef.current("recover");
                  }}
                >
                  <RotateCcw size={19} /> Return to nearest road
                </button>
                <button className="ts-text-button" onClick={() => void leave()}>
                  End run and return to lobby
                </button>
              </>
            )}
            {overlay === "settings" && (
              <>
                <label className="ts-setting">
                  <span>
                    Graphics
                    <small>
                      Auto adjusts resolution to protect frame rate.
                    </small>
                  </span>
                  <select
                    value={quality}
                    onChange={(e) => {
                      const q = e.target.value as typeof quality;
                      setQuality(q);
                      renderer.current?.setQuality(q);
                    }}
                  >
                    <option value="auto">Adaptive</option>
                    <option value="high">High clarity</option>
                    <option value="battery">Battery saver</option>
                  </select>
                </label>
                <button
                  className="ts-setting"
                  onClick={() => {
                    setSound(!sound);
                    if (audio.current) audio.current.enabled = !sound;
                    void audio.current?.unlock();
                  }}
                >
                  <span>
                    Sound<small>Engine and mission cues</small>
                  </span>
                  {sound ? <Volume2 size={22} /> : <VolumeX size={22} />}
                </button>
                <p className="ts-muted">
                  Live performance: {fps} FPS. High clarity uses up to 2× pixel
                  density. Actual performance depends on your phone.
                </p>
                <button
                  className="ts-menu-row"
                  onClick={() => setOverlay("help")}
                >
                  <HelpCircle size={19} /> Touch and keyboard controls{" "}
                  <ChevronRight size={18} />
                </button>
                <button
                  className="ts-menu-row"
                  onClick={() => setOverlay("credits")}
                >
                  <Compass size={19} /> City and asset credits{" "}
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            {overlay === "help" && (
              <>
                <p>
                  Move the left stick in the direction you want to go. Drag the
                  right side of the screen to look around.
                </p>
                <div className="ts-help-grid">
                  <CarFront />
                  <p>
                    <strong>Enter or exit</strong>Tap the car button within 7 m.
                    Brake to a stop before getting out. Keyboard: E.
                  </p>
                  <Gauge />
                  <p>
                    <strong>Drive</strong>Left stick steers. Hold GAS to
                    accelerate; BRAKE slows, then reverses. Keyboard: WASD or
                    arrows, Space for handbrake.
                  </p>
                  <Footprints />
                  <p>
                    <strong>Walk</strong>Left stick moves relative to the
                    camera. Hold SPRINT to run. Keyboard: WASD + Shift.
                  </p>
                  <Flag />
                  <p>
                    <strong>Complete the job</strong>Follow the lime route and
                    reach each marker. Deliveries need a full stop. Beat Ardi in
                    races or escape the patrol in pursuit jobs.
                  </p>
                </div>
                <p className="ts-muted">
                  F fires toward your camera aim. R reloads, Q opens your
                  arsenal and H holsters. Recover to the road from the menu.
                  Escape opens the menu. Career chapters save online; Explore +
                  AI runs do not change your career.
                </p>
              </>
            )}
            {overlay === "map" && (
              <>
                <CityMap
                  player={player}
                  state={view}
                  route={routeRef.current}
                  large
                />
                <p className="ts-muted">
                  Street layout and footprints:{" "}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    © OpenStreetMap contributors · ODbL
                  </a>
                  . Landmark exteriors are artistic reconstructions. Playable
                  district: central Tirana.
                </p>
              </>
            )}
            {overlay === "credits" && (
              <>
                <p>
                  An original, fictional city sandbox set on real central Tirana
                  geography. This is a compact playable district; building
                  facades and landmark models are artistic approximations.
                </p>
                <ul className="ts-credits-list">
                  <li>
                    <a href="/assets/tirana-streets/albanian-forces/ATTRIBUTION.md" target="_blank" rel="noreferrer">
                      Forcat e Shqipërisë · Vehicles and uniforms
                    </a>
                    <span>MakeHuman community, Neubi, lubomircenovsky, Cyberbotics, gakpoenya · CC0 / CC BY / CC BY-SA / Apache 2.0</span>
                  </li>
                  <li>
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                    >
                      OpenStreetMap contributors
                    </a>
                    <span>Streets + footprints · ODbL 1.0</span>
                  </li>
                  <li>
                    <a
                      href="https://kenney.nl/assets/car-kit"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Kenney Car Kit
                    </a>
                    <span>Vehicles · CC0</span>
                  </li>
                  <li>
                    <a
                      href="https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Adobe / Mixamo · Chess human
                    </a>
                    <span>Animated human · Free game-use terms</span>
                  </li>
                  <li>
                    <a
                      href="https://quaternius.com/packs/downtowncitymegakit.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Quaternius Downtown City
                    </a>
                    <span>PBR buildings · CC0</span>
                  </li>
                  <li>
                    <a
                      href="https://polyhaven.com/a/asphalt_02"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Poly Haven Asphalt 02
                    </a>
                    <span>Road textures · CC0</span>
                  </li>
                  <li>
                    <a
                      href="https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/CarConcept/README.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Eric Chadwick / DGG · Car Concept
                    </a>
                    <span>Detailed car · CC BY 4.0</span>
                  </li>
                  <li>
                    <a
                      href="/assets/tirana-streets/living/ATTRIBUTION.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ludo arsenal · Individual artist credits
                    </a>
                    <span>Firearms · CC BY 4.0 / CC0</span>
                  </li>
                  <li>
                    <a
                      href="https://opengameart.org/content/fancy-motorcycle"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Teh_Bucket · Motorcycle
                    </a>
                    <span>Motorcycle · CC0</span>
                  </li>
                </ul>
                <a
                  href="/assets/tirana-streets/living/ATTRIBUTION.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Full source and license notes ↗
                </a>
              </>
            )}
          </section>
        </div>
      )}
      {!ready && !fatal && (
        <div className="ts-loading-badge" role="status">
          <span />
          {loading}
        </div>
      )}
      {fatal && (
        <div className="ts-fatal" role="alert">
          <Compass size={38} />
          <h2>The city couldn’t load.</h2>
          <p>
            Check your connection and WebGL support, then reload to try again.
          </p>
          <details>
            <summary>Details</summary>
            {fatal}
          </details>
          <button
            className="ts-primary"
            onClick={() => window.location.reload()}
          >
            RELOAD CITY <RotateCcw size={19} />
          </button>
        </div>
      )}
    </main>
  );
}
