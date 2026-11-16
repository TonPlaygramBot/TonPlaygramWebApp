import { useEffect, useId, useRef, type ReactNode, type MouseEvent } from 'react';
import AvatarTimer from './AvatarTimer.jsx';
import BottomLeftIcons from './BottomLeftIcons.jsx';

export const seatedGameClassName = 'fixed inset-0 bg-[#0c1020] text-white touch-pan-y select-none';

const fallbackSeats = [
  { left: '50%', top: '84%' },
  { left: '80%', top: '56%' },
  { left: '52%', top: '24%' },
  { left: '20%', top: '56%' }
];

type Player = {
  index: number;
  seatIndex?: number;
  name: string;
  color?: string;
  photoUrl?: string;
  detail?: string;
  label?: string;
};

type Anchor = { x: number; y: number; depth: number };

export function SeatedGameAvatars({ players, anchors, localIndex, turn, timerPct = 1, keepInView = false, onPlayer }: {
  players: Player[];
  anchors: ReadonlyMap<number, Anchor>;
  localIndex: number | null;
  turn: number | null;
  timerPct?: number;
  keepInView?: boolean;
  onPlayer?: (index: number) => void;
}) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {players.map(player => {
        const seat = player.seatIndex ?? player.index;
        const anchor = anchors.get(seat);
        const local = player.index === localIndex;
        const fallback = fallbackSeats[seat] ?? fallbackSeats[3];
        const position = local
          ? { left: '50%', top: '86%' }
          : anchor ? {
              left: keepInView ? `clamp(1.75rem, ${anchor.x}%, calc(100% - 1.75rem))` : `${anchor.x}%`,
              top: keepInView ? `clamp(3.5rem, ${anchor.y}%, 76%)` : `${anchor.y}%`
            } : fallback;
        const size = anchor ? Math.min(0.94, Math.max(0.72, 1.08 - (anchor.depth - 2.6) * 0.18)) : 0.78;
        const active = turn === player.index;
        const avatar = (
          <AvatarTimer index={player.index} photoUrl={player.photoUrl} active={active} isTurn={active}
            timerPct={active && local ? timerPct : 1} name={player.name} color={player.color}
            size={size} nameCurveRadius={52} selfPlayer={local} />
        );
        return (
          <div key={player.index} data-seat-index={seat} data-self-player={!local ? false : undefined}
            aria-label={player.label} aria-current={active ? true : undefined}
            className="absolute pointer-events-auto flex flex-col items-center"
            style={{ ...position, transform: 'translate(-50%, -50%)' }}>
            {onPlayer && !local ? (
              <button type="button" className="min-h-[44px] min-w-[44px] rounded-full grid place-items-center focus-visible:outline focus-visible:outline-white"
                aria-label={player.label ?? player.name} onClick={() => onPlayer(player.index)}>
                {avatar}
              </button>
            ) : avatar}
            {player.detail && (
              <span data-player-detail className="pointer-events-none absolute top-full mt-3.5 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                {player.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SeatedGameMenu({ open, title, onOpen, onClose, children }: {
  open: boolean;
  title: string;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    return () => trigger.current?.focus();
  }, [open]);

  return (
    <div className="pointer-events-auto absolute left-2 top-[5.35rem] z-30 flex flex-col items-start gap-3">
      <button ref={trigger} type="button" onClick={open ? onClose : onOpen}
        aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={open ? 'Close game settings menu' : 'Open game settings menu'}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <span className="text-base leading-none" aria-hidden="true">☰</span>
        <span className="leading-none">Menu</span>
      </button>
      {open && (
        <div id={id} role="dialog" aria-labelledby={`${id}-title`}
          className="mt-2 flex max-h-[calc(100dvh-10rem)] w-72 max-w-[80vw] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur"
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={`${id}-title`} className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">{title}</h2>
            <button ref={closeButton} type="button" onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition hover:text-white focus-visible:outline focus-visible:outline-sky-300">
              <span className="sr-only">Close</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

export function SeatedGameStatus({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-1/2 z-20 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-center text-sm text-white"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {children}
    </div>
  );
}

const roundButton = 'flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
const socialButton = 'flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border-none bg-transparent p-0 text-white shadow-none transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

function SoundIcon({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M11 5 7.5 8.5H4v7h3.5L11 19V5z" />
      {muted ? <path d="m16 9.5 4 4m0-4-4 4" /> : <path d="M15.5 8.5c1.5 1.2 2.5 2.6 2.5 4.5s-1 3.3-2.5 4.5M18.5 6.5c2.2 1.8 3.5 4.1 3.5 6.5s-1.3 4.7-3.5 6.5" />}
    </svg>
  );
}

export function SeatedGameActions({ overhead, onCamera, onChat, onGift, onWeapon, weaponOpen }: {
  overhead: boolean;
  onCamera: () => void;
  onChat: () => void;
  onGift: () => void;
  onWeapon?: (event: MouseEvent<HTMLButtonElement>) => void;
  weaponOpen?: boolean;
}) {
  return (
    <>
      {onWeapon && (
        <button type="button" onClick={onWeapon} aria-label="Open quick weapon swap" aria-expanded={weaponOpen}
          className="pointer-events-auto absolute bottom-[8.15rem] right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/40 bg-black/65 text-base text-amber-100 shadow-[0_8px_22px_rgba(15,23,42,0.55)] transition hover:border-amber-100/70 hover:bg-black/80">
          ⇄
        </button>
      )}
      <BottomLeftIcons className="absolute right-4 top-[5.2rem] z-20 pointer-events-auto"
        showInfo={false} showChat={false} showGift={false} order={['mute']}
        buttonClassName={roundButton} iconClassName="h-5 w-5" labelClassName="sr-only"
        muteIconOn={<SoundIcon muted />} muteIconOff={<SoundIcon />} />
      <BottomLeftIcons className="absolute right-4 top-[8.7rem] z-20 pointer-events-auto"
        showInfo={false} showChat={false} showGift={false} showMute={false} showCamera2d
        camera2dActive={overhead} onCamera2d={onCamera} order={['camera2d']}
        buttonClassName={roundButton} iconClassName="h-5 w-5" labelClassName="sr-only" />
      <BottomLeftIcons className="absolute bottom-14 left-3 z-20 pointer-events-auto"
        onChat={onChat} showInfo={false} showGift={false} showMute={false} chatIcon="💬"
        buttonClassName={socialButton} iconClassName="text-[1.35rem] leading-none"
        labelClassName="text-[0.6rem] font-extrabold uppercase tracking-[0.08em] leading-none" />
      <BottomLeftIcons className="absolute bottom-14 right-3 z-20 pointer-events-auto"
        onGift={onGift} showInfo={false} showChat={false} showMute={false} order={['gift']}
        buttonClassName={socialButton} iconClassName="text-[1.35rem] leading-none"
        labelClassName="text-[0.6rem] font-extrabold uppercase tracking-[0.08em] leading-none" />
    </>
  );
}
