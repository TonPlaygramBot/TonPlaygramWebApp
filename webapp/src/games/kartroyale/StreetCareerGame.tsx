import React, { useEffect, useRef, useState } from 'react';
import { KartRenderer, type Frame, type Result } from './renderer';
import { KartAudio } from './audio';
import { KartControls } from './KartControls';
import { TRACKS, KARTS } from './simulation.mjs';
import { createHeldRaceInput } from './heldRaceInput.mjs';
import {
  careerStages,
  loadStreetCareer,
  normalizeStreetCareer,
  saveStreetCareer,
  finishStreetStage,
  stageUnlocked,
  CAREER_PAINTS
} from './streetCareer.mjs';
import { formatTime } from './career';
import './kart-controls.css';
import './streetCareer.css';
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};
const stages = careerStages(TRACKS);
export function StreetCareerGame({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<KartRenderer | null>(null),
    audio = useRef<KartAudio | null>(null),
    held = useRef(createHeldRaceInput());
  const [profile, setProfile] = useState(() =>
      loadStreetCareer(storage(), TRACKS, KARTS)
    ),
    profileRef = useRef(profile);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(true),
    [hud, setHud] = useState<Frame | null>(null);
  const [racing, setRacing] = useState(false),
    [paused, setPaused] = useState(false),
    [summary, setSummary] = useState(''),
    [muted, setMuted] = useState(false),
    [camera, setCamera] = useState<'driver' | 'chase'>('driver');
  const active = useRef<string | null>(null),
    done = useRef(true),
    pausedRef = useRef(false);
  profileRef.current = profile;
  const clear = () => {
    held.current.clear();
    engine.current?.clearInput();
  };
  const pause = (value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
    clear();
    engine.current?.pause(value);
    if (value) audio.current?.silence();
  };
  const persist = (next: typeof profile) => {
    profileRef.current = next;
    setProfile(next);
    setSaved(saveStreetCareer(storage(), next));
  };
  useEffect(() => {
    let alive = true;
    const sound = new KartAudio();
    audio.current = sound;
    let game: KartRenderer;
    try {
      game = new KartRenderer(
        host.current!,
        (frame) => {
          if (alive) {
            setHud(frame);
            sound.update(frame, !done.current && !pausedRef.current);
          }
        },
        (result: Result) => {
          if (!alive || done.current || !active.current) return;
          done.current = true;
          clear();
          sound.silence();
          const out = finishStreetStage(
            profileRef.current,
            TRACKS,
            KARTS,
            active.current,
            result
          );
          persist(out.profile);
          setSummary(
            `${out.completed ? 'Stage completed' : 'Stage not cleared'} · +${out.bonus} career XP`
          );
          setRacing(false);
          setPaused(false);
          pausedRef.current = false;
        },
        (message) => {
          if (alive) setError(message);
        }
      );
      engine.current = game;
      game.setCameraMode('driver');
      void game
        .load()
        .then(() => {
          if (alive) {
            game.setKart(profileRef.current.loadout.kart);
            setReady(true);
          }
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    } catch (e) {
      setError(String(e));
    }
    const blur = () => {
      if (!done.current) pause(true);
      else clear();
    };
    const hide = () => {
      if (document.hidden) blur();
    };
    const keys: Record<string, [string, number | boolean]> = {
      w: ['throttle', true],
      arrowup: ['throttle', true],
      s: ['brake', true],
      arrowdown: ['brake', true],
      a: ['steer', -1],
      arrowleft: ['steer', -1],
      d: ['steer', 1],
      arrowright: ['steer', 1],
      ' ': ['drift', true],
      shift: ['boost', true],
      e: ['useItem', true]
    };
    const down = (e: KeyboardEvent) => {
      if (
        done.current ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        (e.target as HTMLElement)?.closest?.(
          'input,select,textarea,button,[contenteditable="true"]'
        )
      )
        return;
      if (e.key === 'Escape') {
        e.preventDefault();
        pause(!pausedRef.current);
        return;
      }
      const value = keys[e.key.toLowerCase()];
      if (!value || pausedRef.current) return;
      e.preventDefault();
      held.current.hold(`key:${e.key.toLowerCase()}`, ...value);
      Object.assign(game.input, held.current.read());
    };
    const up = (e: KeyboardEvent) => {
      held.current.release(`key:${e.key.toLowerCase()}`);
      if (game) Object.assign(game.input, held.current.read());
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      alive = false;
      done.current = true;
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      clear();
      game?.destroy();
      sound.destroy();
      engine.current = null;
    };
  }, []);
  const customize = (key: string, value: string) => {
    const next = normalizeStreetCareer(
      {
        ...profileRef.current,
        loadout: { ...profileRef.current.loadout, [key]: value }
      },
      TRACKS,
      KARTS
    );
    persist(next);
    engine.current?.setKart(next.loadout.kart);
    engine.current?.setColor(next.loadout.paint);
  };
  function start(id: string) {
    const stage = stages.find((s) => s.id === id);
    if (
      !ready ||
      !stage ||
      !stageUnlocked(profileRef.current, stages, id) ||
      !done.current
    )
      return;
    clear();
    setError('');
    setSummary('');
    setHud(null);
    pausedRef.current = false;
    setPaused(false);
    try {
      engine.current!.setKart(profileRef.current.loadout.kart);
      engine.current!.setColor(profileRef.current.loadout.paint);
      active.current = id;
      done.current = false;
      audio.current?.unlock();
      engine.current!.startStreetCareer(
        id,
        stage.difficulty,
        profileRef.current.loadout
      );
      setRacing(true);
    } catch (e) {
      done.current = true;
      setError(String(e));
    }
  }
  const board = () => {
    done.current = true;
    active.current = null;
    clear();
    audio.current?.silence();
    engine.current?.showGarage();
    setRacing(false);
    setPaused(false);
    pausedRef.current = false;
  };
  const hold = (id: string, key: string, value: number | boolean) => {
    if (done.current || pausedRef.current) return;
    held.current.hold(id, key, value);
    if (engine.current)
      Object.assign(engine.current.input, held.current.read());
  };
  const release = (id: string) => {
    held.current.release(id);
    if (engine.current)
      Object.assign(engine.current.input, held.current.read());
  };
  return (
    <main className="street-career" aria-label="Tirana Racing Streets career">
      <div className="sc-canvas" ref={host} />
      <header>
        <div>
          <small>TIRANA RACING STREETS</small>
          <h1>
            {racing
              ? stages.find((s) => s.id === active.current)?.name
              : 'Career'}
          </h1>
        </div>
        <button
          onClick={() => {
            board();
            onExit();
          }}
        >
          GARAGE
        </button>
      </header>
      {error && (
        <p className="sc-alert" role="alert">
          {error}
        </p>
      )}
      {!racing ? (
        <section className="sc-board">
          <p>
            {Object.keys(profile.completed).length}/{stages.length} stages ·{' '}
            {profile.xp} XP
          </p>
          <p className="sc-note">
            Local practice career. XP, supplies and bonuses are not TPG and
            cannot be withdrawn. Progress saves only on this device.
          </p>
          {!saved && (
            <p role="alert">
              Device save unavailable. Progress remains only in this session.
            </p>
          )}
          {summary && <p role="status">{summary}</p>}
          <fieldset>
            <legend>Driver & kart</legend>
            <label>
              Driver
              <select
                value={profile.loadout.driver}
                onChange={(e) => customize('driver', e.target.value)}
              >
                <option value="turi">Turi · original character</option>
                <option value="helmet">Helmet racing driver</option>
              </select>
            </label>
            <label>
              Kart
              <select
                value={profile.loadout.kart}
                onChange={(e) => customize('kart', e.target.value)}
              >
                {KARTS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paint
              <select
                value={profile.loadout.paint}
                onChange={(e) => customize('paint', e.target.value)}
              >
                {CAREER_PAINTS.map((p, i) => (
                  <option value={p} key={p}>
                    {['Lime', 'Blue', 'Rose', 'Violet'][i]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Starting supplies · refilled each stage</legend>
            <label>
              Ammunition
              <select
                value={profile.loadout.ammo}
                onChange={(e) => customize('ammo', e.target.value)}
              >
                <option value="single">1 rocket</option>
                <option disabled={profile.xp < 300} value="double">
                  2 rockets · 300 XP
                </option>
              </select>
            </label>
            <label>
              Shield
              <select
                value={profile.loadout.shield}
                onChange={(e) => customize('shield', e.target.value)}
              >
                <option value="single">1 shield charge</option>
                <option disabled={profile.xp < 600} value="double">
                  2 shield charges · 600 XP
                </option>
              </select>
            </label>
          </fieldset>
          {!ready && !error && <p role="status">Loading the city and karts…</p>}
          <p>
            Each stage: finish, podium, win, and finish with at least 90%
            condition. Each task pays 25 XP once. Stage completion adds its
            bonus once.
          </p>
          <div className="sc-stages">
            {stages.map((s) => (
              <article key={s.id}>
                <small>STAGE {s.number}</small>
                <h2>{s.name}</h2>
                <p>
                  Top {s.target} · {s.reward} XP bonus
                </p>
                <p>
                  {profile.tasks[s.id]?.length || 0}/4 tasks
                  {profile.best[s.id]
                    ? ` · Best ${formatTime(profile.best[s.id])}`
                    : ''}
                </p>
                <button
                  disabled={!ready || !stageUnlocked(profile, stages, s.id)}
                  onClick={() => start(s.id)}
                >
                  {profile.completed[s.id]
                    ? 'REPLAY'
                    : stageUnlocked(profile, stages, s.id)
                      ? 'RACE'
                      : 'LOCKED'}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="sc-hud" aria-label="Career race status">
            <b>
              {hud?.countdown
                ? `START ${hud.countdown}`
                : `LAP ${hud?.lap || 1}/3 · P${hud?.position || 1}`}
            </b>
            <span>
              {formatTime(hud?.time || 0)} · {Math.round(hud?.health ?? 100)}%
              condition
            </span>
            <button onClick={() => pause(!paused)}>
              {paused ? 'RESUME' : 'PAUSE'}
            </button>
            <button
              onClick={() => {
                const next = camera === 'driver' ? 'chase' : 'driver';
                setCamera(next);
                engine.current?.setCameraMode(next);
              }}
            >
              {camera === 'driver' ? 'CHASE CAMERA' : 'DRIVER CAMERA'}
            </button>
            <button
              onClick={() => {
                setMuted(!muted);
                audio.current?.setMuted(!muted);
              }}
            >
              {muted ? 'UNMUTE' : 'MUTE'}
            </button>
          </section>
          <div className="sc-supplies">
            <small>Load an empty pickup slot, then tap USE or E.</small>
            {(['rocket', 'shield'] as const).map((kind) => (
              <button
                key={kind}
                disabled={
                  paused ||
                  !!hud?.countdown ||
                  !!hud?.raceItem ||
                  !hud?.careerSupplies?.[kind]
                }
                onClick={() => engine.current?.equipStreetSupply(kind)}
              >
                LOAD {kind.toUpperCase()} · {hud?.careerSupplies?.[kind] ?? 0}
              </button>
            ))}
          </div>
          <KartControls
            hold={hold}
            release={release}
            disabled={paused}
            boost={hud?.boost || 0}
            raceItem={hud?.raceItem}
            itemShield={hud?.itemShield}
            reversing={hud?.reversing}
            drifting={hud?.drifting}
            driftCharge={hud?.driftCharge}
            turbo={hud?.turbo}
          />
          {paused && (
            <section className="sc-pause" aria-label="Career paused">
              <h2>Paused</h2>
              <button onClick={() => pause(false)}>CONTINUE</button>
              <button onClick={board}>RETURN TO CAREER</button>
              <p>Leaving an unfinished race earns no stage rewards.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
