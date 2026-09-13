import React, { useEffect, useRef, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Camera, Gift, Grid2X2, MessageCircle, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import './airHockey.css';

type ControlsProps = {
  topView: boolean;
  muted: boolean;
  settingsOpen: boolean;
  lift: number;
  minLift: number;
  maxLift: number;
  onView: () => void;
  onMute: () => void;
  onSettings: () => void;
  onChat: () => void;
  onGift: () => void;
  onLift: (direction: number) => void;
};

export function AirHockeyControls(props: ControlsProps) {
  const actions = [
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal, action: props.onSettings, pressed: props.settingsOpen },
    { id: 'sound', label: props.muted ? 'Unmute' : 'Sound', icon: props.muted ? VolumeX : Volume2, action: props.onMute, pressed: !props.muted },
    { id: 'view', label: props.topView ? '3D view' : 'Top view', icon: props.topView ? Camera : Grid2X2, action: props.onView, pressed: props.topView },
    { id: 'chat', label: 'Chat', icon: MessageCircle, action: props.onChat },
    { id: 'gift', label: 'Gift', icon: Gift, action: props.onGift }
  ];
  return <>
    {!props.topView && <div className="ah-camera-lift" role="group" aria-label="Camera height">
      <button type="button" aria-label="Lift camera angle up" disabled={props.lift >= props.maxLift} onClick={() => props.onLift(1)}><ArrowUp aria-hidden="true" /></button>
      <Camera aria-hidden="true" className="ah-lift-label" />
      <button type="button" aria-label="Lower camera angle down" disabled={props.lift <= props.minLift} onClick={() => props.onLift(-1)}><ArrowDown aria-hidden="true" /></button>
    </div>}
    <nav className="ah-controls" aria-label="Air Hockey controls">
      {actions.map(({ id, label, icon: Icon, action, pressed }) => <button
        key={id} type="button" onClick={action} aria-label={label}
        aria-pressed={pressed} aria-expanded={label === 'Settings' ? props.settingsOpen : undefined}
        aria-controls={label === 'Settings' ? 'air-hockey-settings' : undefined}
      ><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </nav>
  </>;
}

export function AirHockeySettingsSheet({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return <dialog id="air-hockey-settings" ref={dialog} className="ah-settings-sheet"
    aria-labelledby="ah-settings-title" onCancel={onClose} onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ah-sheet-surface">
      <header className="ah-sheet-heading"><h2 id="ah-settings-title">Match settings</h2>
        <button type="button" aria-label="Close settings" onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <div className="ah-sheet-content">{children}
        <details className="ah-model-credits"><summary>Table credits</summary>
          <p>“Air Hockey Table” by <a href="https://sketchfab.com/Hoven66" target="_blank" rel="noreferrer">Hoven66</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Geometry separated and fitted for play; material lighting adjusted.</p>
        </details>
      </div>
    </div>
  </dialog>;
}
