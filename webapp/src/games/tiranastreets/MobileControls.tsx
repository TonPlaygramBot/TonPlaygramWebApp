import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  CarFront,
  Crosshair,
  Hand,
  RotateCcw,
  Briefcase
} from 'lucide-react';
import type { CityInput } from './input';
import { thumbStick, TouchChannels } from './shared/touch.mjs';

type Props = {
  input: MutableRefObject<CityInput | null>;
  driving: boolean;
  disabled: boolean;
  armed: boolean;
  canEnter: boolean;
  onLook: (dx: number, dy: number) => void;
  onAction: (action: string) => void;
  onArsenal: () => void;
};

export function MobileControls({
  input,
  driving,
  disabled,
  armed,
  canEnter,
  onLook,
  onAction,
  onArsenal
}: Props) {
  const owners = useRef(new TouchChannels());
  const lastLook = useRef({ x: 0, y: 0 });
  const knob = useRef<HTMLDivElement>(null);
  const moveLabel = useRef<HTMLSpanElement>(null);
  const reset = useCallback(() => {
    owners.current.clear();
    if (input.current)
      Object.assign(input.current.touch, {
        x: 0,
        y: 0,
        gas: 0,
        fast: false,
        brake: false,
        fire: false
      });
    if (knob.current) knob.current.style.transform = '';
    if (moveLabel.current)
      moveLabel.current.textContent = driving
        ? 'STEER'
        : 'MOVE · OUTER RING TO RUN';
  }, [input, driving]);
  useEffect(() => {
    reset();
  }, [disabled, reset]);
  useEffect(() => {
    const blur = () => reset(),
      visibility = () => {
        if (document.hidden) reset();
      };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      reset();
    };
  }, [reset]);

  const begin = (channel: string, e: PointerEvent<HTMLElement>) => {
    if (
      disabled ||
      e.button !== 0 ||
      !owners.current.begin(channel, e.pointerId)
    )
      return false;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    return true;
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!input.current || !owners.current.owns('move', e.pointerId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const stick = thumbStick(
      e.clientX - rect.left - rect.width / 2,
      e.clientY - rect.top - rect.height / 2,
      rect.width * 0.38,
      driving,
      input.current.touch.fast
    );
    input.current.touch.x = stick.x;
    input.current.touch.y = stick.y;
    input.current.touch.fast = stick.sprint;
    if (knob.current)
      knob.current.style.transform = `translate(${stick.knobX}px, ${stick.knobY}px)`;
    if (moveLabel.current)
      moveLabel.current.textContent = driving
        ? 'STEER'
        : stick.sprint
          ? 'RUNNING'
          : 'MOVE · OUTER RING TO RUN';
  };
  const endMove = (e: PointerEvent<HTMLElement>) => {
    if (!owners.current.end('move', e.pointerId)) return;
    if (input.current)
      Object.assign(input.current.touch, { x: 0, y: 0, fast: false });
    if (knob.current) knob.current.style.transform = '';
    if (moveLabel.current)
      moveLabel.current.textContent = driving
        ? 'STEER'
        : 'MOVE · OUTER RING TO RUN';
  };
  const look = (e: PointerEvent<HTMLElement>) => {
    if (!owners.current.owns('look', e.pointerId)) return;
    onLook(e.clientX - lastLook.current.x, e.clientY - lastLook.current.y);
    lastLook.current = { x: e.clientX, y: e.clientY };
  };
  const startLook = (e: PointerEvent<HTMLElement>, fire = false) => {
    if (!begin('look', e)) return;
    lastLook.current = { x: e.clientX, y: e.clientY };
    if (input.current) input.current.touch.fire = fire;
  };
  const endLook = (e: PointerEvent<HTMLElement>) => {
    if (owners.current.end('look', e.pointerId) && input.current)
      input.current.touch.fire = false;
  };
  const hold = (channel: 'gas' | 'brake', value: number | boolean) => {
    const end = (e: PointerEvent<HTMLElement>) => {
      if (owners.current.end(channel, e.pointerId) && input.current)
        Object.assign(input.current.touch, {
          [channel]: channel === 'gas' ? 0 : false
        });
    };
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (begin(channel, e) && input.current)
          Object.assign(input.current.touch, { [channel]: value });
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end
    };
  };
  return (
    <>
      <div
        className="ts-camera-zone"
        style={{ pointerEvents: disabled ? 'none' : undefined }}
        aria-label="Drag the city to look around"
        onPointerDown={(e) => startLook(e)}
        onPointerMove={look}
        onPointerUp={endLook}
        onPointerCancel={endLook}
        onLostPointerCapture={endLook}
      />
      <div
        className="ts-mobile-controls"
        data-disabled={disabled}
        data-driving={driving}
      >
        <div
          className="ts-thumb-move"
          role="group"
          aria-label={
            driving
              ? 'Steer left and right'
              : 'Move; push to the outer ring to run'
          }
          onPointerDown={(e) => {
            if (begin('move', e)) move(e);
          }}
          onPointerMove={move}
          onPointerUp={endMove}
          onPointerCancel={endMove}
          onLostPointerCapture={endMove}
        >
          <div className="ts-thumb-ring" />
          <div className="ts-thumb-knob" ref={knob} />
          <span ref={moveLabel}>
            {driving ? 'STEER' : 'MOVE · OUTER RING TO RUN'}
          </span>
        </div>
        <div className="ts-thumb-actions">
          {driving ? (
            <button
              className="ts-touch-secondary"
              aria-label="Hold to reverse"
              {...hold('gas', -1)}
            >
              <ArrowDown size={22} />
              <small>REVERSE</small>
            </button>
          ) : (
            <button
              className="ts-touch-secondary"
              onClick={onArsenal}
              aria-label="Open equipment"
            >
              <Briefcase size={22} />
              <small>GEAR</small>
            </button>
          )}
          <button
            className="ts-touch-secondary"
            disabled={disabled || !canEnter}
            onClick={() => onAction('vehicle')}
            aria-label={
              driving ? 'Stop and exit vehicle' : 'Enter nearby vehicle'
            }
          >
            <CarFront size={23} />
            <small>{driving ? 'EXIT' : 'ENTER'}</small>
          </button>
          {driving ? (
            <button
              className="ts-touch-secondary"
              aria-label="Hold the brake"
              {...hold('brake', true)}
            >
              <Hand size={22} />
              <small>BRAKE</small>
            </button>
          ) : (
            <button
              className="ts-touch-secondary"
              disabled={!armed || disabled}
              onClick={() => onAction('reload')}
              aria-label="Reload"
            >
              <RotateCcw size={22} />
              <small>RELOAD</small>
            </button>
          )}
          {driving ? (
            <button
              className="ts-touch-primary ts-throttle"
              aria-label="Hold to accelerate"
              {...hold('gas', 1)}
            >
              <ArrowUp size={28} />
              <small>GAS</small>
            </button>
          ) : (
            <button
              className="ts-touch-primary ts-trigger"
              disabled={!armed || disabled}
              aria-label="Hold and drag to aim and fire"
              onPointerDown={(e) => startLook(e, true)}
              onPointerMove={look}
              onPointerUp={endLook}
              onPointerCancel={endLook}
              onLostPointerCapture={endLook}
            >
              <Crosshair size={30} />
              <small>FIRE</small>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
