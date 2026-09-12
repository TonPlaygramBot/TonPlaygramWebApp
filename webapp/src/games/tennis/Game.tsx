'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { TennisRenderer } from './render';
import { TennisAudio } from './audio';
import { LineReview } from './LineReview';
import {
  STROKES,
  courtCue,
  scoreMoment,
  freshStats,
  collectStats
} from './feedback';
import {
  beginSwipe,
  readSwipe,
  sampleSwipe,
  TAP_POWER,
  type Swipe
} from '../../../../shared/tennis/swipe';
import {
  advance,
  createMatch,
  neutralInput,
  pointLabels,
  reviewActive,
  setInput,
  side,
  Input,
  MatchState,
  Seat,
  Shot,
  Surface
} from './engine';
import {
  Career,
  freshCareer,
  GameServices,
  matchConfig,
  normalizeCareer,
  RoomSnapshot,
  TOUR
} from './career';

export default function TennisGame({
  services,
  inline = false,
  launch,
  onLobby
}: {
  services: GameServices;
  inline?: boolean;
  launch?: {
    mode: string;
    surface: Surface;
    difficulty: number;
    format: string;
    tableId?: string;
  };
  onLobby?: () => void;
}) {
  const canvas = useRef<HTMLDivElement>(null),
    frame = useRef<MatchState>(createMatch()),
    renderer = useRef<TennisRenderer | null>(null),
    audio = useRef<TennisAudio | null>(null),
    input = useRef<Input>(neutralInput());
  const running = useRef(false),
    pausedRef = useRef(false),
    modeRef = useRef('quick'),
    roomRef = useRef<RoomSnapshot | null>(null),
    careerId = useRef(''),
    settledId = useRef(''),
    pointer = useRef<number | null>(null),
    touches = useRef(new Set<number>()),
    charging = useRef(false),
    gesture = useRef<Swipe | null>(null),
    stats = useRef(freshStats()),
    nextSwing = useRef(0);
  const [screen, setScreen] = useState<
      'home' | 'career' | 'online' | 'match' | 'help' | 'credits'
    >('home'),
    [hud, setHud] = useState<MatchState>(() => createMatch()),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(false),
    [assist, setAssist] = useState(true),
    [hints, setHints] = useState(true),
    [eco, setEco] = useState(false),
    [strokeMenu, setStrokeMenu] = useState(false),
    [confirmExit, setConfirmExit] = useState(false),
    [difficulty, setDifficulty] = useState(launch?.difficulty ?? 2),
    [surface, setSurface] = useState<Surface>(launch?.surface ?? 'hard'),
    [format, setFormat] = useState(launch?.format ?? 'quick'),
    [shot, setShot] = useState<Shot>('flat'),
    [aim, setAim] = useState(0),
    [charge, setCharge] = useState(0),
    [career, setCareer] = useState<Career>(freshCareer()),
    [busy, setBusy] = useState(false),
    [room, setRoom] = useState<RoomSnapshot | null>(null),
    [code, setCode] = useState(''),
    [onlineStatus, setOnlineStatus] = useState(''),
    [resultSaved, setResultSaved] = useState(false);
  const launched = useRef(false);
  useEffect(() => {
    if (!ready || !launch || launched.current) return;
    launched.current = true;
    if (launch.mode === 'online') {
      setBusy(true);
      services
        .joinRoom(launch.tableId || '')
        .then((r) => {
          reset();
          frame.current = r.state;
          roomRef.current = r;
          setRoom(r);
          running.current = true;
          modeRef.current = 'online';
          setScreen('match');
          updateHud();
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    } else if (launch.mode === 'career') setScreen('career');
    else start(launch.format);
  }, [ready]);
  const own: Seat = room?.seat ?? 0;
  const updateHud = () => setHud(structuredClone(frame.current));
  useEffect(() => {
    let cancelled = false;
    services
      .career()
      .then((c) => {
        if (!cancelled) setCareer(normalizeCareer(c));
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            'Career save is unavailable. Quick matches are still ready.'
          );
      });
    return () => {
      cancelled = true;
    };
  }, [services]);
  useEffect(() => {
    if (!canvas.current) return;
    let view: TennisRenderer;
    try {
      view = new TennisRenderer(canvas.current, 0);
      renderer.current = view;
      audio.current = new TennisAudio();
      view.ready.then(() => {
        if (!view.disposed) setReady(!view.loadError);
      });
    } catch {
      setError(
        '3D graphics are unavailable in this browser. Try opening the full game in Safari or Chrome.'
      );
      return;
    }
    let raf = 0,
      last = 0,
      acc = 0,
      lastHud = 0,
      lastStep = 0,
      reportedError = '';
    const tick = (now: number) => {
      if ((!running.current || pausedRef.current) && now - last < 1000 / 30) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.06) : 0;
      last = now;
      if (running.current && !pausedRef.current && !roomRef.current) {
        setInput(frame.current, 0, input.current);
        acc += dt;
        while (acc >= 1 / 120) {
          advance(frame.current, 1 / 120);
          acc -= 1 / 120;
        }
      }
      if (charging.current && gesture.current) {
        const { power, dx } = readSwipe(gesture.current, now);
        if (now - lastHud > 80) {
          setCharge(power);
          setAim(dx);
        }
      }
      view.draw(frame.current, dt, !!roomRef.current);
      collectStats(stats.current, frame.current);
      if (audio.current) audio.current.seat = roomRef.current?.seat ?? 0;
      audio.current?.events(frame.current.events);
      if (
        running.current &&
        frame.current.phase === 'rally' &&
        now - lastStep > 270 &&
        !pausedRef.current &&
        Math.hypot(
          frame.current.players[view.seat].x -
            frame.current.players[view.seat].targetX,
          frame.current.players[view.seat].z -
            frame.current.players[view.seat].targetZ
        ) > 0.3
      ) {
        audio.current?.sample('step', 1.3);
        lastStep = now;
      }
      if (view.loadError && view.loadError !== reportedError) {
        reportedError = view.loadError;
        setError(view.loadError);
      }
      if (running.current && !pausedRef.current && now - lastHud > 85) {
        updateHud();
        lastHud = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hidden = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        last = 0;
        acc = 0;
        charging.current = false;
        pointer.current = null;
        gesture.current = null;
        touches.current.clear();
        input.current.moveX = null;
        input.current.moveZ = null;
        setCharge(0);
        if (running.current && !roomRef.current) {
          pausedRef.current = true;
          setPaused(true);
        }
      } else {
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      charging.current = false;
      pointer.current = null;
      gesture.current = null;
      touches.current.clear();
      input.current.moveX = input.current.moveZ = null;
      setCharge(0);
      if (running.current && !roomRef.current) {
        pausedRef.current = true;
        setPaused(true);
      }
      setNotice('Graphics interrupted. Waiting for the court to recover…');
    };
    const contextRestored = () =>
      setNotice('Court restored. You can continue playing.');
    view.renderer.domElement.addEventListener('webglcontextlost', contextLost);
    view.renderer.domElement.addEventListener(
      'webglcontextrestored',
      contextRestored
    );
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(raf);
      view.dispose();
      audio.current?.dispose();
      document.removeEventListener('visibilitychange', hidden);
      view.renderer.domElement.removeEventListener(
        'webglcontextlost',
        contextLost
      );
      view.renderer.domElement.removeEventListener(
        'webglcontextrestored',
        contextRestored
      );
    };
    // This effect owns the renderer and simulation loop for the life of the game.
  }, []);
  useEffect(() => {
    input.current.assist = assist;
  }, [assist]);
  useEffect(() => {
    if (audio.current) audio.current.enabled = !muted;
  }, [muted]);
  useEffect(() => {
    renderer.current?.setQuality(eco ? 'low' : 'high');
  }, [eco]);
  useEffect(() => {
    if (renderer.current) renderer.current.guides = hints;
  }, [hints]);
  useEffect(() => {
    if (renderer.current) {
      renderer.current.seat = own;
      renderer.current.resizeToFit();
    }
  }, [own]);
  useEffect(() => {
    if (!room) return;
    let live = true,
      timer: ReturnType<typeof setTimeout>,
      failures = 0;
    const sync = async () => {
      try {
        const next = await services.syncRoom(room.code, input.current);
        if (!live) return;
        roomRef.current = next;
        frame.current = next.state;
        failures = 0;
        setRoom((prev) =>
          prev
            ? { ...prev, joined: next.joined, settlement: next.settlement }
            : prev
        );
        setOnlineStatus(
          !next.joined
            ? 'Waiting for opponent…'
            : Date.now() - next.peerSeen > 12000
              ? 'Opponent disconnected. Waiting to reconnect…'
              : 'Connected · live match'
        );
      } catch (e) {
        if (!live) return;
        failures++;
        const message = e instanceof Error ? e.message : '';
        if (message.includes('ended or expired')) {
          setOnlineStatus('This room has ended. Leave to start a new match.');
          return;
        }
        setOnlineStatus(
          failures > 2 ? 'Connection interrupted. Reconnecting…' : 'Connecting…'
        );
      }
      if (live) timer = setTimeout(sync, 140);
    };
    sync();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [room?.code, services]);
  useEffect(() => {
    if (
      hud.phase !== 'over' ||
      modeRef.current !== 'career' ||
      !careerId.current ||
      settledId.current === careerId.current
    )
      return;
    const id = careerId.current;
    settledId.current = id;
    services
      .finishCareer(id, hud.winner === 0, hud.bestRally)
      .then((c) => {
        setCareer(normalizeCareer(c));
        setResultSaved(true);
      })
      .catch(() => {
        settledId.current = '';
        setError(
          'Career result could not save. Tap Retry save before leaving.'
        );
      });
  }, [hud.phase, hud.eventId, services]);
  const unlock = () => {
    audio.current?.unlock().catch(() => {});
  };
  const reset = () => {
    input.current = { ...neutralInput(), assist };
    charging.current = false;
    pointer.current = null;
    gesture.current = null;
    touches.current.clear();
    setCharge(0);
    stats.current = freshStats();
    setStrokeMenu(false);
    setConfirmExit(false);
    nextSwing.current = 0;
    setShot('flat');
    setAim(0);
    pausedRef.current = false;
    setPaused(false);
    setError('');
    setNotice('');
    setResultSaved(false);
    if (audio.current) audio.current.lastEvent = 0;
  };
  const start = async (mode: string) => {
    if (!ready || busy) return;
    unlock();
    setBusy(true);
    try {
      let c = career;
      reset();
      modeRef.current = mode;
      if (mode === 'career') {
        const result = await services.startCareer();
        careerId.current = result.id;
        c = normalizeCareer(result.career);
        setCareer(c);
      } else careerId.current = '';
      frame.current = createMatch(matchConfig(mode, c, difficulty, surface));
      running.current = true;
      roomRef.current = null;
      setRoom(null);
      setScreen('match');
      updateHud();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start match.');
    } finally {
      setBusy(false);
    }
  };
  const exit = async () => {
    if (roomRef.current)
      await services.leaveRoom(roomRef.current.code).catch(() => {});
    roomRef.current = null;
    setRoom(null);
    running.current = false;
    reset();
    setScreen(modeRef.current === 'career' ? 'career' : 'home');
    if (modeRef.current !== 'career') onLobby?.();
    frame.current = createMatch({ surface });
    updateHud();
  };
  const pause = () => {
    if (roomRef.current) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    setStrokeMenu(false);
    setConfirmExit(false);
    if (!next) unlock();
    charging.current = false;
    pointer.current = null;
    gesture.current = null;
    touches.current.clear();
    input.current.moveX = null;
    input.current.moveZ = null;
    setCharge(0);
  };
  const release = (power: number) => {
    if (!charging.current) return;
    charging.current = false;
    input.current.power = power;
    input.current.swing = ++nextSwing.current;
    // Keep the released power visible until the next gesture.
    setCharge(power);
  };
  const chooseAim = (v: number) => {
    setAim(v);
    input.current.aim = v * side(own);
  };
  const chooseShot = (v: Shot) => {
    setShot(v);
    input.current.shot = v;
    setStrokeMenu(false);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    if (gesture.current) {
      const coalesced = e.nativeEvent.getCoalescedEvents?.() || [];
      for (const point of coalesced)
        sampleSwipe(
          gesture.current,
          point.clientX,
          point.clientY,
          point.timeStamp
        );
      sampleSwipe(gesture.current, e.clientX, e.clientY, e.timeStamp);
    }
    if (input.current.assist) return;
    const rect = e.currentTarget.getBoundingClientRect();
    input.current.moveX =
      (((e.clientX - rect.left) / rect.width) * 2 - 1) * 5.15 * side(own);
    const y = (e.clientY - rect.top) / rect.height;
    input.current.moveZ =
      2.8 + Math.max(0, Math.min(1, (y - 0.35) / 0.55)) * 10;
  };
  const openRoom = async (join: boolean) => {
    setBusy(true);
    setError('');
    unlock();
    try {
      const r = join
        ? await services.joinRoom(code)
        : await services.createRoom();
      reset();
      frame.current = r.state;
      roomRef.current = r;
      setRoom(r);
      running.current = true;
      modeRef.current = 'online';
      setScreen('match');
      updateHud();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  };
  const train = async (stat: number) => {
    setBusy(true);
    try {
      setCareer(normalizeCareer(await services.upgrade(stat)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save upgrade.');
    } finally {
      setBusy(false);
    }
  };
  const scores = pointLabels(hud.score),
    op = own === 0 ? 1 : 0,
    opponentName =
      modeRef.current === 'career'
        ? TOUR[Math.min(career.tour, TOUR.length - 1)].opponents[
            Math.min(career.round, 2)
          ]
        : room
          ? room.players?.[op]?.name || 'Online player'
          : ['Club AI', 'Tour AI', 'Pro AI'][difficulty];
  const canHit = () =>
    screen === 'match' &&
    !paused &&
    !reviewActive(frame.current) &&
    (frame.current.phase === 'serve' || frame.current.phase === 'rally') &&
    (!room || room.joined) &&
    (frame.current.phase !== 'serve' || frame.current.score.server === own);
  const tour = TOUR[career.tour];
  const finishCourtTouch = (e: React.PointerEvent<HTMLDivElement>) => {
    touches.current.delete(e.pointerId);
    if (pointer.current !== e.pointerId || !gesture.current) return;
    sampleSwipe(gesture.current, e.clientX, e.clientY, e.timeStamp);
    const { power, dx, dy } = readSwipe(gesture.current);
    input.current.direction =
      renderer.current?.shotDirection(dx, dy, frame.current) ?? null;
    // A tap has no heading: softly return towards centre (diagonal on serve).
    chooseAim(dx);
    if (canHit()) release(power);
    else charging.current = false;
    pointer.current = null;
    gesture.current = null;
    input.current.moveX = null;
    input.current.moveZ = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  useEffect(() => {
    const dialogs =
      canvas.current?.parentElement?.querySelectorAll<HTMLElement>('.tr-modal');
    const dialog = dialogs?.[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'
        )
      );
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmExit) setConfirmExit(false);
        else if (pausedRef.current) pause();
      }
      if (event.key !== 'Tab') return;
      const items = controls(),
        first = items[0],
        last = items[items.length - 1];
      if (
        !dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [paused, confirmExit, screen, hud.phase, reviewActive(hud)]);
  return (
    <div
      className={`tr-game ${inline ? 'tr-inline' : ''}`}
      data-screen={screen}
    >
      {onLobby && screen !== 'match' && (
        <button className="tr-app-lobby" onClick={onLobby}>
          ← Games lobby
        </button>
      )}
      <div
        className="tr-court"
        ref={canvas}
        onPointerDown={(e) => {
          if (e.button !== 0 || screen !== 'match' || paused) return;
          touches.current.add(e.pointerId);
          e.currentTarget.setPointerCapture(e.pointerId);
          if (touches.current.size > 1) {
            pointer.current = null;
            gesture.current = null;
            charging.current = false;
            input.current.moveX = input.current.moveZ = null;
            setCharge(0);
            return;
          }
          if (
            screen !== 'match' ||
            paused ||
            reviewActive(frame.current) ||
            pointer.current !== null ||
            e.button !== 0
          )
            return;
          setStrokeMenu(false);
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = beginSwipe(
            e.clientX,
            e.clientY,
            e.timeStamp,
            e.currentTarget.clientWidth
          );
          move(e);
          if (canHit()) {
            unlock();
            charging.current = true;
            setCharge(TAP_POWER);
          }
        }}
        onPointerMove={move}
        onPointerUp={finishCourtTouch}
        onLostPointerCapture={(e) => {
          touches.current.delete(e.pointerId);
          if (pointer.current !== e.pointerId) return;
          pointer.current = null;
          gesture.current = null;
          input.current.moveX = null;
          input.current.moveZ = null;
          charging.current = false;
          setCharge(0);
        }}
        onPointerCancel={(e) => {
          touches.current.delete(e.pointerId);
          if (pointer.current !== e.pointerId) return;
          pointer.current = null;
          gesture.current = null;
          input.current.moveX = null;
          input.current.moveZ = null;
          charging.current = false;
          setCharge(0);
        }}
      />
      <div className="tr-vignette" />
      <header className="tr-top">
        <button
          className="tr-brand"
          onClick={() => {
            if (screen === 'match') pause();
            else if (onLobby) onLobby();
            else setScreen('home');
          }}
          aria-label="Tennis Royal home"
        >
          <span className="tr-brand-ball">◉</span> TENNIS <b>ROYAL</b>
        </button>
        <div className="tr-top-actions">
          <Button
            variant="ghost"
            className="tr-icon"
            aria-label={muted ? 'Enable sound' : 'Mute sound'}
            onClick={() => {
              unlock();
              setMuted(!muted);
            }}
          >
            {muted ? '♪̸' : '♪'}
          </Button>
          <Button
            variant="ghost"
            className="tr-icon"
            aria-label={screen === 'match' ? 'Pause match' : 'How to play'}
            disabled={screen === 'match' && !!room}
            onClick={() => (screen === 'match' ? pause() : setScreen('help'))}
          >
            {screen === 'match' ? 'Ⅱ' : '?'}
          </Button>
        </div>
      </header>
      {screen === 'match' && (
        <>
          <div className="tr-scoreboard">
            <div className="tr-match-label">
              {room
                ? 'ONLINE'
                : modeRef.current === 'career'
                  ? tour.name
                  : 'EXHIBITION'}
              <span>
                {hud.config.surface.toUpperCase()} ·{' '}
                {hud.score.tie
                  ? 'TIE-BREAK'
                  : hud.config.gamesToWin === 1
                    ? '1 GAME'
                    : hud.config.setsToWin === 2
                      ? 'BEST OF 3 SETS'
                      : 'SHORT SET'}
              </span>
            </div>
            <div className="tr-score-head" aria-hidden="true">
              <span>PLAYER</span>
              <span>SETS</span>
              <span>GAMES</span>
              <span>PTS</span>
            </div>
            <div className="tr-score-row">
              <span className="tr-player-name">
                <i className="tr-player-dot" />
                <span className="tr-name-text">You</span>{' '}
                {hud.score.server === own && (
                  <small aria-label="Serving">●</small>
                )}
              </span>
              <span className="tr-set-score">{hud.score.sets[own]}</span>
              <span className="tr-games-score">{hud.score.games[own]}</span>
              <b>{scores[own]}</b>
            </div>
            <div className="tr-score-row tr-opponent">
              <span className="tr-player-name">
                <i className="tr-player-dot" />
                <span className="tr-name-text">{opponentName}</span>
                {hud.score.server === op && (
                  <small aria-label="Serving">●</small>
                )}
              </span>
              <span className="tr-set-score">{hud.score.sets[op]}</span>
              <span className="tr-games-score">{hud.score.games[op]}</span>
              <b>{scores[op]}</b>
            </div>
          </div>
          {scoreMoment(hud, own) &&
            !reviewActive(hud) &&
            (hud.phase === 'serve' ||
              hud.phase === 'rally' ||
              hud.phase === 'toss') && (
              <div className="tr-moment" role="status">
                {scoreMoment(hud, own)}
              </div>
            )}
          {room && (
            <div className="tr-network" role="status">
              {onLobby ? 'ONLINE MATCH' : 'ROOM'}{' '}
              {!onLobby && <b>{room.code}</b>} · {onlineStatus}
            </div>
          )}
          <div className="tr-call" role="status" hidden={reviewActive(hud)}>
            {hud.phase === 'serve'
              ? hud.score.server === own
                ? hud.fault
                  ? 'Second serve'
                  : 'Your serve'
                : 'Opponent serves'
              : hud.phase === 'fault'
                ? hud.message
                : hud.phase === 'point'
                  ? `${hud.message.split(' · ')[0]} · ${hud.lastPoint === own ? 'Your' : 'Opponent'} point`
                  : hud.phase === 'toss'
                    ? 'Ball toss'
                    : hud.phase === 'over'
                      ? ''
                      : hud.rally > 1
                        ? `${hud.rally} shot rally`
                        : 'Return the serve'}
          </div>
          <div className="tr-touch-hud" hidden={reviewActive(hud)}>
            {hints && (
              <p className="tr-live-cue" role="status">
                {courtCue(hud, own, assist)}
              </p>
            )}
            {strokeMenu && (
              <div
                className="tr-strokes"
                role="group"
                aria-label="Choose your stroke"
              >
                {STROKES.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    aria-pressed={shot === option.value}
                    onClick={() => chooseShot(option.value)}
                  >
                    <b>{option.label}</b>
                    <small>{option.hint}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="tr-touch-state">
              <button
                type="button"
                className="tr-stroke-picker"
                aria-label={`Shot type: ${shot}. Change stroke`}
                aria-expanded={strokeMenu}
                onClick={() => setStrokeMenu(!strokeMenu)}
              >
                {shot === 'flat' ? 'Drive' : shot} ▾
              </button>
              <b>{aim < -0.15 ? 'Left' : aim > 0.15 ? 'Right' : 'Centre'}</b>
              <span className="tr-power-value">
                {Math.round(charge * 100)}% power
              </span>
            </div>
            <div
              className="tr-power"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(charge * 100)}
              aria-label={`Shot power ${Math.round(charge * 100)} percent`}
            >
              <i style={{ width: `${charge * 100}%` }} />
            </div>
            <p className="tr-control-note">
              {assist ? 'Auto movement' : 'Drag to move'} · swipe to aim & hit
            </p>
          </div>
          {reviewActive(hud) && hud.review && (
            <LineReview review={hud.review} time={hud.time} />
          )}
        </>
      )}
      {screen === 'home' && (
        <div className="tr-home">
          <div className="tr-kicker">
            <span /> THE COURT IS YOURS
          </div>
          <h1>
            TENNIS
            <br />
            <em>ROYAL</em>
          </h1>
          <p className="tr-home-sub">Find your rhythm. Own the rally.</p>
          <div className="tr-home-bottom">
            <Button
              className="tr-primary"
              disabled={!ready || busy}
              onClick={() => start(format)}
            >
              {!ready ? 'Loading court…' : 'PLAY VS AI'}
              <span>↗</span>
            </Button>
            <div className="tr-secondary-row">
              <Button className="tr-mode" onClick={() => setScreen('career')}>
                <span>✦</span>
                <b>Career</b>
                <small>Your rise to No. 1</small>
              </Button>
              <Button
                className="tr-mode"
                onClick={() => (onLobby ? onLobby() : setScreen('online'))}
              >
                <span>◎</span>
                <b>Play online</b>
                <small>Challenge a friend</small>
              </Button>
            </div>
            <div className="tr-options">
              <label>
                Opponent
                <select
                  aria-label="AI difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                >
                  <option value={0}>Club</option>
                  <option value={1}>Tour</option>
                  <option value={2}>Pro</option>
                </select>
              </label>
              <label>
                Court
                <select
                  aria-label="Court surface"
                  value={surface}
                  onChange={(e) => {
                    const next = e.target.value as Surface;
                    setSurface(next);
                    frame.current.config.surface = next;
                  }}
                >
                  <option value="hard">Hard</option>
                  <option value="clay">Clay</option>
                  <option value="grass">Grass</option>
                </select>
              </label>
              <label>
                Match
                <select
                  aria-label="Match length"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="quick">1 game</option>
                  <option value="set">1 set</option>
                  <option value="full">3 sets</option>
                </select>
              </label>
            </div>
            <div className="tr-home-footer">
              <button onClick={() => setScreen('help')}>How to play</button>
              <span>3D · TOUCH · SOUND</span>
              <button onClick={() => setScreen('credits')}>Credits</button>
            </div>
          </div>
        </div>
      )}
      {screen === 'career' && (
        <div className="tr-panel">
          <Button
            variant="ghost"
            className="tr-back"
            onClick={() => setScreen('home')}
          >
            ← Court
          </Button>
          <span className="tr-eyebrow">CAREER TOUR</span>
          <h2>{career.completed ? 'World champion.' : tour.name}</h2>
          <p>
            {career.completed
              ? 'Every trophy earned. Your circuit is complete.'
              : `${tour.place} · ${tour.surface} court · ${['Quarter-final', 'Semi-final', 'Final'][career.round]}`}
          </p>
          <div className="tr-career-stats">
            <div>
              <b>{career.wins}</b>
              <span>Wins</span>
            </div>
            <div>
              <b>{career.losses}</b>
              <span>Losses</span>
            </div>
            <div>
              <b>{career.credits}</b>
              <span>Skill points</span>
            </div>
          </div>
          <div className="tr-tour-list">
            {TOUR.map((t, i) => (
              <div
                className={`tr-tour ${i === career.tour ? 'current' : ''}`}
                key={t.name}
              >
                <span>
                  {i < career.tour || career.completed
                    ? '✓'
                    : String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <b>{t.name}</b>
                  <small>
                    {t.place} · {t.surface}
                  </small>
                </div>
                <span>
                  {i < career.tour || career.completed
                    ? 'WON'
                    : i === career.tour
                      ? 'NEXT'
                      : 'LOCKED'}
                </span>
              </div>
            ))}
          </div>
          <div className="tr-training">
            <h3>
              Train your player <small>2 points per upgrade</small>
            </h3>
            {['Speed', 'Power', 'Reach'].map((name, i) => (
              <Button
                key={name}
                className="tr-upgrade"
                disabled={busy || career.credits < 2 || career.upgrades[i] >= 3}
                onClick={() => train(i)}
              >
                {name}
                <span>
                  {'●'.repeat(career.upgrades[i])}
                  {'○'.repeat(3 - career.upgrades[i])}
                </span>
                <b>+</b>
              </Button>
            ))}
          </div>
          {!career.completed && (
            <Button
              className="tr-primary"
              disabled={busy || !ready}
              onClick={() => start('career')}
            >
              PLAY {['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'][career.round]}
              <span>↗</span>
            </Button>
          )}
          {inline && (
            <small className="tr-save-note">
              Preview career lasts for this session. The full game saves
              progress.
            </small>
          )}
        </div>
      )}
      {screen === 'online' && (
        <div className="tr-panel tr-online-panel">
          <Button
            variant="ghost"
            className="tr-back"
            onClick={() => setScreen('home')}
          >
            ← Court
          </Button>
          <span className="tr-eyebrow">HEAD TO HEAD</span>
          <h2>Meet on court.</h2>
          <p>
            Create a room, then share its code with a friend. Both players use
            the full game.
          </p>
          {services.online ? (
            <>
              <Button
                className="tr-primary"
                disabled={busy}
                onClick={() => openRoom(false)}
              >
                CREATE ROOM<span>↗</span>
              </Button>
              <div className="tr-or">OR JOIN A FRIEND</div>
              <label className="tr-room-label">
                Room code
                <input
                  value={code}
                  maxLength={6}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  autoComplete="off"
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )
                  }
                />
              </label>
              <Button
                className="tr-secondary"
                disabled={busy || code.length !== 6}
                onClick={() => openRoom(true)}
              >
                JOIN ROOM
              </Button>
              <small>
                First to 3 games · tie-break at 3–3 · no AI substitution
              </small>
            </>
          ) : (
            <div className="tr-online-info">
              <b>Online rooms are in the full game.</b>
              <p>
                You can play AI matches and try the career here. Open the
                full-game link beside this preview to play with a friend.
              </p>
              <Button className="tr-primary" onClick={() => start(format)}>
                PLAY VS AI
              </Button>
            </div>
          )}
        </div>
      )}
      {screen === 'help' && (
        <div className="tr-panel">
          <Button
            variant="ghost"
            className="tr-back"
            onClick={() => setScreen('home')}
          >
            ← Court
          </Button>
          <span className="tr-eyebrow">FIRST RALLY</span>
          <h2>Make your move.</h2>
          <ol className="tr-help">
            <li>
              <b>Serve</b>
              <p>
                Tap for a soft diagonal serve, or swipe toward the opposite
                service box. Faster finger movement gives the ball more speed;
                holding still does not build power.
              </p>
            </li>
            <li>
              <b>Return</b>
              <p>
                Your player moves to intercept the ball. Tap for a soft return
                or release a swipe as the ball approaches. You can queue a shot
                just before it reaches your racket.
              </p>
            </li>
            <li>
              <b>Find the space</b>
              <p>
                Swipe toward the opponent and angle your finger left or right to
                steer. The direction follows your movement, wherever the gesture
                starts on screen. Tap the stroke badge to choose drive, topspin,
                slice or lob without changing your swipe direction.
              </p>
            </li>
            <li>
              <b>Close line calls</b>
              <p>
                A bounce on or close to a line is replayed after the point.
                Watch the slow-motion approach and the ball mark with the IN or
                OUT decision. Play resumes automatically.
              </p>
            </li>
          </ol>
          <p className="tr-rules-note">
            Two bounces, a net shot, or landing outside the singles lines loses
            the point. Win deuce by two points. Full matches are best of three
            six-game sets.
          </p>
          <Button className="tr-primary" onClick={() => start(format)}>
            LET’S PLAY<span>↗</span>
          </Button>
        </div>
      )}
      {screen === 'credits' && (
        <div className="tr-panel">
          <Button
            variant="ghost"
            className="tr-back"
            onClick={() => setScreen('home')}
          >
            ← Court
          </Button>
          <span className="tr-eyebrow">MADE FOR THE COURT</span>
          <h2>
            Open assets.
            <br />
            Original tennis.
          </h2>
          <p>
            Human player models:{' '}
            <a
              href="https://quaternius.com/packs/universalbasecharacters.html"
              target="_blank"
              rel="noreferrer"
            >
              Quaternius Universal Base Characters
            </a>
            , CC0. Tennis kits and skeletal movement adapted for this game.
          </p>
          <p>
            Impact and footstep samples:{' '}
            <a
              href="https://kenney.nl/assets/impact-sounds"
              target="_blank"
              rel="noreferrer"
            >
              Kenney Impact Sounds
            </a>
            , CC0. Crowd and match stings synthesized.
          </p>
          <p>
            Court, rackets, match simulation, career, and interface created for
            Tennis Royal. Three.js and React are MIT licensed.
          </p>
          <small>
            All opponents in solo and career modes are AI. Career events and
            names are fictional.
          </small>
        </div>
      )}
      {paused && screen === 'match' && (
        <div
          className="tr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Match paused"
        >
          <div className="tr-modal-card">
            <span className="tr-eyebrow">TAKE A BREATHER</span>
            <h2>Match paused.</h2>
            <div className="tr-settings">
              <label>
                <span>
                  Auto movement<small>Player follows the ball</small>
                </span>
                <input
                  type="checkbox"
                  checked={assist}
                  onChange={(e) => setAssist(e.target.checked)}
                />
              </label>
              <label>
                <span>
                  Coaching hints<small>Tips during the rally</small>
                </span>
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={(e) => setHints(e.target.checked)}
                />
              </label>
              <label>
                <span>
                  Battery saver<small>Lower resolution, fewer shadows</small>
                </span>
                <input
                  type="checkbox"
                  checked={eco}
                  onChange={(e) => setEco(e.target.checked)}
                />
              </label>
              <label>
                <span>Sound</span>
                <input
                  type="checkbox"
                  checked={!muted}
                  onChange={(e) => {
                    unlock();
                    setMuted(!e.target.checked);
                  }}
                />
              </label>
            </div>
            <Button className="tr-primary" onClick={pause}>
              BACK TO COURT<span>↗</span>
            </Button>
            <Button
              className="tr-secondary"
              onClick={() => setConfirmExit(true)}
            >
              LEAVE MATCH
            </Button>
          </div>
        </div>
      )}
      {hud.phase === 'over' && !reviewActive(hud) && screen === 'match' && (
        <div className="tr-modal">
          <div className="tr-modal-card">
            <span className="tr-eyebrow">GAME. SET. MATCH.</span>
            <div className="tr-trophy">{hud.winner === own ? '✦' : '◉'}</div>
            <h2>
              {room && hud.winner === null
                ? 'Match closed.'
                : hud.winner === own
                  ? 'You win.'
                  : 'Keep swinging.'}
            </h2>
            {room && (
              <p>
                {room.settlement?.status === 'refunded'
                  ? 'Stakes refunded.'
                  : room.settlement?.status === 'finished'
                    ? 'Stake settlement complete.'
                    : 'Settling stakes… Please wait.'}
              </p>
            )}
            <p>
              {hud.score.history.map((s) => `${s[own]}–${s[op]}`).join(' · ')} ·
              Best rally: {hud.bestRally} shots
            </p>
            <div
              className="tr-result-stats"
              aria-label={
                room ? 'Your stats since joining' : 'Your match stats'
              }
            >
              <div>
                <b>{stats.current.points[own]}</b>
                <span>Points won</span>
              </div>
              <div>
                <b>{stats.current.shots[own]}</b>
                <span>Shots hit</span>
              </div>
              <div>
                <b>{hud.bestRally}</b>
                <span>Best rally</span>
              </div>
            </div>
            {room && (
              <small className="tr-session-note">
                Shot and point stats since joining
              </small>
            )}
            {modeRef.current === 'career' && (
              <p>
                {resultSaved
                  ? hud.winner === 0
                    ? 'Career progress saved. Next round unlocked.'
                    : 'Result saved. Train and try again.'
                  : 'Saving career result…'}
              </p>
            )}
            <Button className="tr-primary" onClick={exit}>
              {modeRef.current === 'career'
                ? 'BACK TO CAREER'
                : 'BACK TO COURT'}
              <span>↗</span>
            </Button>
            {modeRef.current !== 'career' && !room && (
              <Button
                className="tr-secondary"
                onClick={() => start(modeRef.current)}
              >
                REMATCH
              </Button>
            )}
          </div>
        </div>
      )}
      {room && !room.joined && screen === 'match' && (
        <div className="tr-wait">
          <b>{onLobby ? 'Match found' : room.code}</b>
          <p>
            {onLobby
              ? 'Waiting for your opponent to load the court.'
              : 'Share this code with your opponent.'}
          </p>
          <Button className="tr-secondary" onClick={exit}>
            {onLobby ? 'LEAVE MATCH' : 'CANCEL ROOM'}
          </Button>
        </div>
      )}
      {room && room.joined && (
        <button
          className="tr-leave-online"
          onClick={() => setConfirmExit(true)}
        >
          Leave
        </button>
      )}
      {confirmExit && (
        <div
          className="tr-modal tr-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Leave this match?"
        >
          <div className="tr-modal-card">
            <h2>Leave this match?</h2>
            <p>
              {room
                ? 'Leaving retires you from this online match.'
                : 'Your current match will end.'}
            </p>
            <Button
              className="tr-primary"
              onClick={() => setConfirmExit(false)}
            >
              KEEP PLAYING
            </Button>
            <Button className="tr-secondary" onClick={exit}>
              LEAVE MATCH
            </Button>
          </div>
        </div>
      )}
      {(error || notice) && (
        <div className="tr-toast" role={error ? 'alert' : 'status'}>
          {error || notice}
          {error.includes('Retry save') && (
            <Button
              onClick={async () => {
                try {
                  setCareer(
                    await services.finishCareer(
                      careerId.current,
                      hud.winner === 0,
                      hud.bestRally
                    )
                  );
                  setResultSaved(true);
                  setError('');
                } catch {
                  setError('Could not save yet. Retry save.');
                }
              }}
            >
              Retry save
            </Button>
          )}
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
