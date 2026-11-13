import React, { useEffect, useRef, type MutableRefObject } from 'react';
import { ArrowLeft, ArrowRight, ChevronsUp, Zap } from 'lucide-react';
import { neutralInput, type Input } from './simulation.mjs';
export default function Controls({
  input,
  onGesture
}: {
  input: MutableRefObject<Input>;
  onGesture: () => void;
}) {
  const gesture = useRef(onGesture);
  gesture.current = onGesture;
  const held = useRef(new Map<string, string>());
  const apply = () => {
    const keys = [...held.current.values()];
    input.current = {
      steer: Number(keys.includes('right')) - Number(keys.includes('left')),
      throttle: keys.includes('gas'),
      brake: keys.includes('brake'),
      boost: keys.includes('boost'),
      recover: false
    };
  };
  const clear = () => {
    held.current.clear();
    input.current = neutralInput();
  };
  useEffect(() => {
    const map: Record<string, string> = {
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      ArrowUp: 'gas',
      w: 'gas',
      W: 'gas',
      ArrowDown: 'brake',
      s: 'brake',
      S: 'brake',
      ' ': 'boost',
      Shift: 'boost'
    };
    const down = (e: KeyboardEvent) => {
      if (
        !map[e.key] ||
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName)
      )
        return;
      e.preventDefault();
      held.current.set(`key-${e.key}`, map[e.key]);
      apply();
      gesture.current();
    };
    const up = (e: KeyboardEvent) => {
      if (map[e.key]) {
        e.preventDefault();
        held.current.delete(`key-${e.key}`);
        apply();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      clear();
    };
  }, []);
  const button = (
    action: string,
    label: string,
    icon: React.ReactNode,
    className = ''
  ) => (
    <button
      className={`jsr-control ${className}`}
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current.set(`pointer-${e.pointerId}`, action);
        apply();
        gesture.current();
      }}
      onPointerUp={(e) => {
        held.current.delete(`pointer-${e.pointerId}`);
        apply();
      }}
      onPointerCancel={(e) => {
        held.current.delete(`pointer-${e.pointerId}`);
        apply();
      }}
      onLostPointerCapture={(e) => {
        held.current.delete(`pointer-${e.pointerId}`);
        apply();
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="jsr-controls">
      <div className="jsr-steering">
        {button('left', 'Left', <ArrowLeft size={27} />)}
        {button('right', 'Right', <ArrowRight size={27} />)}
      </div>
      <div className="jsr-pedals">
        {button('boost', 'Boost', <Zap size={20} />, 'jsr-boost')}
        <div className="jsr-pedal-row">
          {button('brake', 'Brake', <span className="jsr-brake-icon">Ⅱ</span>)}
          {button('gas', 'Throttle', <ChevronsUp size={30} />, 'jsr-gas')}
        </div>
      </div>
    </div>
  );
}
