import {useEffect, useId, useRef, useState} from 'react';
import './weapon-switcher.css';
export type WeaponSlot = {id: string; label: string; thumbnail: string; ammo?: number; reserve?: number};
/** Uses pre-rendered thumbnails of the existing models: no extra WebGL context,
 * model download or account purchase is needed to open the quick selector. */
export function WeaponSwitcher({weapons, selected, disabled = false, onSelect, onOpen}: {
  weapons: WeaponSlot[]; selected: string; disabled?: boolean;
  onSelect: (id: string) => boolean; onOpen: () => void;
}) {
  const [open, setOpen] = useState(false), [notice, setNotice] = useState('');
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), id = useId();
  const close = () => {setOpen(false); trigger.current?.focus();};
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const outside = (e: PointerEvent) => {if (!root.current?.contains(e.target as Node)) setOpen(false);};
    const escape = (e: KeyboardEvent) => {if (e.key === 'Escape') {e.preventDefault(); e.stopImmediatePropagation(); close();}};
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => {document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true);};
  }, [open]);
  useEffect(() => {if (disabled) setOpen(false);}, [disabled]);
  return <div ref={root} className="ts-weapon-switcher" onPointerDown={e => e.stopPropagation()} onKeyDown={e => {if (open) e.stopPropagation();}}>
    <button ref={trigger} className="ts-weapon-trigger" aria-label="Switch weapon" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => {if (open) close(); else {onOpen(); setNotice(''); setOpen(true);}}}>
      <span aria-hidden="true">⇄</span> WEAPONS
    </button>
    {open && <section id={id} className="ts-weapon-picker" aria-label="Available weapons">
      <header><strong>AVAILABLE WEAPONS</strong><button aria-label="Close weapon selector" onClick={close}>×</button></header>
      <div className="ts-weapon-thumbnails">
        {weapons.map(w => <button key={w.id} aria-label={`Equip ${w.label}`} aria-pressed={selected === w.id}
          onClick={() => {if (selected === w.id || onSelect(w.id)) close(); else setNotice('Finish your current action before switching.');}}>
          <img src={w.thumbnail} width="128" height="72" alt="" loading="lazy" decoding="async"/>
          <span>{w.label}</span><small>{selected === w.id ? 'EQUIPPED' : w.ammo === undefined ? 'MELEE' : `${w.ammo} / ${w.reserve ?? 0}`}</small>
        </button>)}
      </div>
      {!weapons.length && <p>No weapons available yet.</p>}
      {notice && <p role="status">{notice}</p>}
    </section>}
  </div>;
}
