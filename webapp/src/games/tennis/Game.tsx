'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { TennisRenderer } from './render';
import { TennisAudio } from './audio';
import {
  advance,
  createMatch,
  neutralInput,
  pointLabels,
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
    chargeAt = useRef(0),
    charging = useRef(false),
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
    [difficulty, setDifficulty] = useState(launch?.difficulty ?? 1),
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
        if (!cancelled) setCareer(c);
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
      setReady(true);
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
      lastStep = 0;
    const tick = (now: number) => {
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
      if (charging.current) {
        const power = Math.min(1, 0.2 + (now - chargeAt.current) / 1050);
        input.current.power = power;
        if (now - lastHud > 80) setCharge(power);
      }
      view.draw(frame.current, dt, !!roomRef.current);
      audio.current?.events(frame.current.events);
      if (
        running.current &&
        frame.current.phase === 'rally' &&
        now - lastStep > 270 &&
        Math.abs(
          frame.current.players[0].x - frame.current.players[0].targetX
        ) > 0.3
      ) {
        audio.current?.sample('step', 1.3);
        lastStep = now;
      }
      if (view.loadError && !error) setError(view.loadError);
      if (now - lastHud > 85) {
        updateHud();
        lastHud = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hidden = () => {
      if (document.hidden) {
        charging.current = false;
        setCharge(0);
        if (running.current && !roomRef.current) {
          pausedRef.current = true;
          setPaused(true);
        }
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(raf);
      view.dispose();
      audio.current?.dispose();
      document.removeEventListener('visibilitychange', hidden);
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
        setCareer(c);
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
    setCharge(0);
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
        c = result.career;
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
    charging.current = false;
    setCharge(0);
  };
  const release = () => {
    if (!charging.current) return;
    charging.current = false;
    input.current.power = Math.max(
      0.2,
      Math.min(1, (performance.now() - chargeAt.current) / 1050 + 0.2)
    );
    input.current.swing = ++nextSwing.current;
    setCharge(0);
  };
  const chooseAim = (v: number) => {
    setAim(v);
    input.current.aim = v * side(own);
  };
  const chooseShot = (v: Shot) => {
    setShot(v);
    input.current.shot = v;
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
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
      setCareer(await services.upgrade(stat));
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
  const canHit =
    screen === 'match' &&
    !paused &&
    hud.phase !== 'point' &&
    hud.phase !== 'over' &&
    (!room || room.joined) &&
    (hud.phase !== 'serve' || hud.score.server === own);
  const tour = TOUR[career.tour];
  return (
    <div className={`tr-game ${inline ? 'tr-inline' : ''}`}>
      {onLobby && screen !== 'match' && (
        <button className="tr-app-lobby" onClick={onLobby}>
          ← Games lobby
        </button>
      )}
      <div
        className="tr-court"
        ref={canvas}
        onPointerDown={(e) => {
          if (screen !== 'match' || paused) return;
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          if (pointer.current === e.pointerId) {
            pointer.current = null;
            input.current.moveX = null;
            input.current.moveZ = null;
          }
        }}
        onPointerCancel={() => {
          pointer.current = null;
          input.current.moveX = null;
          input.current.moveZ = null;
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
            <div className="tr-score-row">
              <span className="tr-player-name">
                <i className="tr-player-dot" />
                You {hud.score.server === own && <small>●</small>}
              </span>
              <span className="tr-set-score">{hud.score.sets[own]}</span>
              <span className="tr-games-score">{hud.score.games[own]}</span>
              <b>{scores[own]}</b>
            </div>
            <div className="tr-score-row tr-opponent">
              <span className="tr-player-name">
                <i className="tr-player-dot" />
                {opponentName}
                {hud.score.server === op && <small>●</small>}
              </span>
              <span className="tr-set-score">{hud.score.sets[op]}</span>
              <span className="tr-games-score">{hud.score.games[op]}</span>
              <b>{scores[op]}</b>
            </div>
          </div>
          {room && (
            <div className="tr-network" role="status">
              {onLobby ? 'ONLINE MATCH' : 'ROOM'}{' '}
              {!onLobby && <b>{room.code}</b>} · {onlineStatus}
            </div>
          )}
          <div className="tr-call" role="status">
            {hud.phase === 'serve'
              ? hud.score.server === own
                ? hud.fault
                  ? 'Second serve'
                  : 'Your serve'
                : 'Opponent serves'
              : hud.phase === 'point'
                ? `${hud.lastPoint === own ? 'Your' : 'Opponent'} point`
                : hud.phase === 'toss'
                  ? 'Ball toss'
                  : hud.phase === 'over'
                    ? ''
                    : hud.rally > 1
                      ? `${hud.rally} shot rally`
                      : 'Return the serve'}
          </div>
          <div className="tr-controls">
            <div className="tr-aim">
              <span>AIM</span>
              {[-1, 0, 1].map((v, i) => (
                <Button
                  key={v}
                  aria-pressed={aim === v}
                  onClick={() => chooseAim(v)}
                  className={`tr-aim-btn ${aim === v ? 'selected' : ''}`}
                >
                  {['Left', 'Centre', 'Right'][i]}
                </Button>
              ))}
              <button
                className="tr-assist"
                onClick={() => setAssist(!assist)}
                aria-pressed={assist}
              >
                Footwork
                <br />
                <b>{assist ? 'Auto' : 'Manual'}</b>
              </button>
            </div>
            <div className="tr-shot-row">
              <div className="tr-shots">
                {(['flat', 'topspin', 'slice', 'lob'] as Shot[]).map((v) => (
                  <Button
                    key={v}
                    onClick={() => chooseShot(v)}
                    aria-pressed={shot === v}
                    className={`tr-shot ${shot === v ? 'selected' : ''}`}
                  >
                    {v === 'flat' ? 'Drive' : v[0].toUpperCase() + v.slice(1)}
                  </Button>
                ))}
              </div>
              <Button
                className="tr-hit"
                disabled={!canHit}
                onPointerDown={(e) => {
                  if (!canHit) return;
                  unlock();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  chargeAt.current = performance.now();
                  charging.current = true;
                  setCharge(0.2);
                }}
                onPointerUp={release}
                onPointerCancel={() => {
                  charging.current = false;
                  setCharge(0);
                }}
                onLostPointerCapture={() => {
                  charging.current = false;
                  setCharge(0);
                }}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    unlock();
                    chargeAt.current = performance.now();
                    charging.current = true;
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    release();
                  }
                }}
              >
                <span
                  className="tr-charge-fill"
                  style={{ height: `${charge * 100}%` }}
                />
                <span>
                  {hud.phase === 'serve' && hud.score.server === own
                    ? 'SERVE'
                    : 'HIT'}
                  <small>
                    {charge ? `${Math.round(charge * 100)}%` : 'HOLD · RELEASE'}
                  </small>
                </span>
              </Button>
            </div>
            <p className="tr-control-tip">
              Drag court to move · release HIT as the ball approaches
            </p>
          </div>
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
              <button onClick={() => setDifficulty((difficulty + 1) % 3)}>
                {['Club', 'Tour', 'Pro'][difficulty]} AI ▾
              </button>
              <button
                onClick={() => {
                  const v: Surface =
                    surface === 'hard'
                      ? 'clay'
                      : surface === 'clay'
                        ? 'grass'
                        : 'hard';
                  setSurface(v);
                  frame.current.config.surface = v;
                }}
              >
                {surface} court ▾
              </button>
              <button
                onClick={() =>
                  setFormat(
                    format === 'quick'
                      ? 'set'
                      : format === 'set'
                        ? 'full'
                        : 'quick'
                  )
                }
              >
                {format === 'quick'
                  ? 'Quick game'
                  : format === 'set'
                    ? 'Short set'
                    : 'Full match'}{' '}
                ▾
              </button>
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
                Hold SERVE for power, then release. The serve goes into the
                diagonal service box.
              </p>
            </li>
            <li>
              <b>Return</b>
              <p>
                When the ball comes towards you, hold HIT and release. Footwork
                assist helps you reach it.
              </p>
            </li>
            <li>
              <b>Find the space</b>
              <p>
                Choose Left, Centre, or Right to aim. Drag on the court to move
                yourself.
              </p>
            </li>
            <li>
              <b>Change the rally</b>
              <p>
                Drive for pace, topspin for a higher bounce, slice for a shorter
                shot, or lob over your opponent.
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
            Animated player models:{' '}
            <a
              href="https://kenney.nl/assets/mini-characters"
              target="_blank"
              rel="noreferrer"
            >
              Kenney Mini Characters
            </a>
            , CC0. Unused animations removed; tennis swings adapted.
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
        <div className="tr-modal">
          <div className="tr-modal-card">
            <span className="tr-eyebrow">TAKE A BREATHER</span>
            <h2>Match paused.</h2>
            <Button className="tr-primary" onClick={pause}>
              BACK TO COURT<span>↗</span>
            </Button>
            <Button className="tr-secondary" onClick={exit}>
              LEAVE MATCH
            </Button>
          </div>
        </div>
      )}
      {hud.phase === 'over' && screen === 'match' && (
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
        <button className="tr-leave-online" onClick={exit}>
          Leave
        </button>
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
