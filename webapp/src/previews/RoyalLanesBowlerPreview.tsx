import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as C from 'cannon-es';
import { HumanBowler } from '../games/royallanes/bowlers';
import { BowlingCamera } from '../games/royallanes/camera';
import { BowlingAudio } from '../games/royallanes/audio';
import { BowlingTouch } from '../games/royallanes/touch';
import {
  createBowlingPhysics,
  LANE_SCALE_X,
  LANE_SPACING,
  PIN_COM,
  pinSpots
} from '../games/royallanes/shared/physicsCore.mjs';
import {
  simulateRoll,
  APPROACH_MS,
  ALL_PINS
} from '../games/royallanes/shared/replay.mjs';
import type { RollReplay, Shot } from '../games/royallanes/types';
declare const ROYAL_MODELS: Record<string, string>;
const Physics = createBowlingPhysics(C);
async function model(name: string) {
  const bytes = Uint8Array.from(atob(ROYAL_MODELS[name]), (c) =>
    c.charCodeAt(0)
  );
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return (
    await new GLTFLoader().parseAsync(
      await new Response(stream).arrayBuffer(),
      ''
    )
  ).scene;
}
function Preview() {
  const stage = useRef<HTMLDivElement>(null),
    api = useRef<any>(null);
  const [status, setStatus] = useState('Loading bowlers…'),
    [character, setCharacter] = useState('adrian'),
    [loop, setLoop] = useState(false),
    [sound, setSound] = useState(false),
    [ready, setReady] = useState(false);
  const options = useRef({ character, loop, sound });
  options.current = { character, loop, sound };
  useEffect(() => {
    const el = stage.current!;
    let dead = false,
      raf = 0,
      last = 0,
      clock = 0,
      elapsed = -1,
      aim = 0.055,
      mainReplay: RollReplay | null = null,
      previous = -1;
    let renderer: T.WebGLRenderer,
      actors: HumanBowler[] = [],
      touch: BowlingTouch | undefined;
    const audio = new BowlingAudio();
    audio.enabled = false;
    const dispose = () => {
      dead = true;
      cancelAnimationFrame(raf);
      touch?.dispose();
      audio.dispose();
      actors.forEach((a) => a.dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
    } catch {
      setStatus('3D preview needs graphics acceleration.');
      return dispose;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = T.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color(0x111a14);
    scene.add(new T.HemisphereLight(0xe9f2ea, 0x695030, 2));
    const light = new T.DirectionalLight(0xffe3b3, 3);
    light.position.set(1, 5, 4);
    scene.add(light);
    const camera = new T.PerspectiveCamera(55, 1, 0.025, 80);
    const cameraRig = new BowlingCamera(camera);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const names = ['adrian', 'maya'];
    void Promise.all([...names.map(model), model('alley'), model('pin')])
      .then(([adrian, maya, alley, pin]) => {
        if (dead) return;
        alley.scale.x *= LANE_SCALE_X;
        scene.add(alley);
        const prototypes = [adrian, adrian, maya],
          choices = [adrian, maya];
        const groups = [0, -LANE_SPACING, LANE_SPACING].map((x) => {
          const g = new T.Group();
          g.position.x = x;
          scene.add(g);
          return g;
        });
        actors = prototypes.map((p, i) => {
          const a = new HumanBowler(p, 0xffffff, false);
          groups[i].add(a.root);
          a.pose({
            active: true,
            rolling: false,
            elapsed: 0,
            dt: 10,
            watching: false,
            time: 0
          });
          return a;
        });
        const balls = groups.map((g, i) => {
          const b = new T.Mesh(
            new T.SphereGeometry(0.1085, 32, 24),
            new T.MeshPhysicalMaterial({
              color: [0x962b4d, 0x325c9e, 0x2f8065][i],
              roughness: 0.17,
              metalness: 0.2,
              clearcoat: 0.9
            })
          );
          g.add(b);
          return b;
        });
        const pins = groups.map((g) =>
          pinSpots().map((p) => {
            const m = pin.clone(true);
            m.position.set(p.x, 0, p.z);
            g.add(m);
            return m;
          })
        );
        const aiReplays = [
          simulateRoll(
            { shot: { aim: 0.05, hook: 0.02, power: 77 }, standing: ALL_PINS },
            Physics
          ),
          simulateRoll(
            { shot: { aim: -0.12, hook: 0.04, power: 72 }, standing: ALL_PINS },
            Physics
          )
        ];
        const release = APPROACH_MS / 1000;
        let current = 'adrian',
          lastLabel = '';
        const bowl = (shot: Shot = { aim, hook: 0, power: 78 }) => {
          if (elapsed >= 0 || dead) return;
          audio.enabled = options.current.sound;
          audio.unlock();
          mainReplay = simulateRoll({ shot, standing: ALL_PINS }, Physics);
          elapsed = 0;
          previous = -1;
        };
        api.current = {
          bowl,
          sound: (value: boolean) => audio.setEnabled(value)
        };
        touch = new BowlingTouch(renderer.domElement, {
          ready: () => elapsed < 0,
          onAim: (v) => {
            aim = v;
          },
          onRoll: bowl,
          onPause: () => {},
          onTap: () => {},
          onInteraction: () => audio.unlock()
        });
        touch.setAim(aim);
        setReady(true);
        setStatus('Swipe up or tap Bowl');
        const qa = new T.Quaternion(),
          qb = new T.Quaternion(),
          offset = new T.Vector3();
        const show = (i: number, replay: RollReplay, t: number) => {
          const ix = T.MathUtils.clamp(
              t * replay.hz,
              0,
              replay.frames.length - 1
            ),
            n = Math.floor(ix),
            a = replay.frames[n],
            b = replay.frames[Math.min(n + 1, replay.frames.length - 1)];
          const put = (o: T.Object3D, k: number, isPin = false) => {
            o.position.set(
              T.MathUtils.lerp(a[k], b[k], ix - n),
              T.MathUtils.lerp(a[k + 1], b[k + 1], ix - n),
              T.MathUtils.lerp(a[k + 2], b[k + 2], ix - n)
            );
            qa.fromArray(a, k + 3);
            qb.fromArray(b, k + 3);
            o.quaternion.slerpQuaternions(qa, qb, ix - n);
            if (isPin)
              o.position.add(
                offset.set(0, -PIN_COM, 0).applyQuaternion(o.quaternion)
              );
          };
          put(balls[i], 0);
          pins[i].forEach((p, id) => put(p, (id + 1) * 7, true));
        };
        const tick = (now: number) => {
          if (dead) return;
          raf = requestAnimationFrame(tick);
          const dt = Math.min(0.05, (now - (last || now)) / 1000);
          last = now;
          if (document.hidden) return;
          clock += dt;
          if (current !== options.current.character) {
            current = options.current.character;
            actors[0].dispose();
            groups[0].remove(actors[0].root);
            actors[0] = new HumanBowler(
              choices[names.indexOf(current)],
              0xffffff,
              false
            );
            groups[0].add(actors[0].root);
          }
          if (elapsed >= 0) elapsed += dt;
          for (let i = 0; i < 3; i++) {
            const replay = i === 0 ? mainReplay : aiReplays[i - 1];
            const t =
              i === 0 ? elapsed : ((clock + (i === 1 ? 4 : 10)) % 17) - 2;
            const end = release + (replay?.durationMs || 0) / 1000;
            const returning = t > end + 2.2,
              rolling = t >= 0 && !!replay && !returning;
            actors[i].pose({
              active: !returning,
              rolling,
              elapsed: Math.max(0, t),
              dt,
              watching: returning,
              time: clock * 1000,
              releaseSeconds: release,
              reaction:
                replay?.knocked === 10
                  ? 'strike'
                  : replay?.gutter
                    ? 'miss'
                    : 'neutral',
              reactionElapsed: rolling ? t - end : -1
            });
            if (t >= release && replay) {
              show(i, replay, t - release);
              balls[i].visible = !returning;
            } else {
              balls[i].visible = true;
              balls[i].position.copy(actors[i].ballSocket);
              for (const spot of pinSpots()) {
                pins[i][spot.id].position.set(spot.x, 0, spot.z);
                pins[i][spot.id].quaternion.identity();
              }
            }
          }
          if (mainReplay && elapsed >= release) {
            const t = elapsed - release;
            if (previous < 0 && t < 0.2) audio.release();
            for (const event of mainReplay.events || [])
              if (
                event.time > previous &&
                event.time <= t &&
                t - event.time < 0.15
              )
                audio.impact(event.strength);
            audio.rolling(
              'main',
              8,
              Math.abs(balls[0].position.z),
              0,
              t < mainReplay.durationMs / 1000 && balls[0].position.z > -20.4
            );
            previous = t;
            if (t > mainReplay.durationMs / 1000 + 5) {
              elapsed = -1;
              mainReplay = null;
              audio.rolling('main', 0, 0, 0, false);
              if (options.current.loop) bowl();
            }
          }
          cameraRig.update(dt, {
            ball: balls[0].position,
            hasRoll: !!mainReplay && elapsed >= 0,
            releaseElapsed: elapsed - release,
            duration: (mainReplay?.durationMs || 0) / 1000
          });
          const label =
            elapsed < 0
              ? 'Swipe up or tap Bowl'
              : actors[0].phase === 'reaction'
                ? `${mainReplay?.knocked} pins`
                : actors[0].phase.replaceAll('-', ' ');
          if (label !== lastLabel) {
            lastLabel = label;
            setStatus(label);
          }
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((e) => {
        if (!dead) setStatus(`Preview could not load: ${e.message}`);
      });
    return () => {
      observer.disconnect();
      dispose();
    };
  }, []);
  return (
    <div className="rl-bowler-preview">
      <div className="rl-preview-title">
        <strong>ROYAL LANES</strong>
        <span>Follow the ball</span>
      </div>
      <div
        ref={stage}
        className="rl-preview-stage"
        role="img"
        aria-label="Interactive 3D bowling with player and two neighbouring human bowlers"
      />
      <div className="rl-preview-status" role="status">
        {status}
      </div>
      <div className="rl-preview-controls">
        <select
          aria-label="Bowler"
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
        >
          <option value="adrian">Adrian</option>
          <option value="maya">Maya</option>
        </select>
        <button disabled={!ready} onClick={() => api.current?.bowl()}>
          Bowl
        </button>
        <button
          aria-pressed={loop}
          onClick={() => {
            setLoop((v) => !v);
            if (!loop) api.current?.bowl();
          }}
        >
          Loop {loop ? 'on' : 'off'}
        </button>
        <button
          aria-pressed={sound}
          onClick={() => {
            setSound((v) => !v);
            api.current?.sound(!sound);
          }}
        >
          Sound {sound ? 'on' : 'off'}
        </button>
      </div>
    </div>
  );
}
createRoot(document.getElementById('royal-lanes-bowlers')!).render(<Preview />);
