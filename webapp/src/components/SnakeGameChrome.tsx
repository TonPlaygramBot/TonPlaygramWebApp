import { Flag, Gift, HelpCircle, Menu, MessageCircle, RefreshCw, ScanLine, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

type Player = { name: string; photoUrl?: string; color?: string; position: number; connected?: boolean };
type HeaderProps = {
  players: Player[]; currentTurn: number; localIndex: number | null; finalTile: number;
  online: boolean; watching: boolean; waiting: boolean; setup: boolean;
  onSettings: () => void; onRules: () => void; onPlayer: (index: number) => void;
};

export function SnakeGameHeader({ players, currentTurn, localIndex, finalTile, online, watching,
  waiting, setup, onSettings, onRules, onPlayer }: HeaderProps) {
  return <header className="snake-game-header">
    <div className="snake-game-titlebar">
      <div className="snake-game-title"><span>TONPLAYGRAM</span><h1>Snake &amp; Ladder</h1>
        <p>{watching ? 'Spectating' : online ? 'Online match' : 'Solo / vs AI'} · First to {finalTile}</p></div>
      <button className="snake-icon-button" type="button" onClick={onRules} aria-label="How to play"><HelpCircle size={20} aria-hidden="true" /></button>
      <button className="snake-icon-button" type="button" onClick={onSettings} aria-label="Open game settings menu"><Menu size={21} aria-hidden="true" /></button>
    </div>
    <ol className="snake-scoreboard" data-count={players.length} aria-label="Player positions" style={{ '--snake-players': Math.max(1, players.length) } as CSSProperties}>
      {players.map((player, index) => {
        const finished = player.position >= finalTile;
        const active = !waiting && !setup && !finished && index === currentTurn;
        const label = `${player.name}${index === localIndex ? ' (you)' : ''}, ${finished ? 'finished' : player.position > 0 ? `tile ${player.position} of ${finalTile}` : 'at start'}${active ? ', current turn' : ''}${player.connected === false ? ', reconnecting' : ''}`;
        return <li key={index}>
          <button type="button" className="snake-score-card" data-player-index={index} data-active={active} onClick={() => onPlayer(index)} aria-label={label} style={{ '--snake-player-color': player.color || '#f5d785' } as CSSProperties}>
            <span className="snake-score-person"><img data-self-player={index === localIndex ? true : undefined} src={player.photoUrl || '/assets/icons/profile.svg'} alt={index === localIndex ? 'Your avatar' : ''} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/assets/icons/profile.svg'; }} /><span>{index === localIndex ? 'You' : player.name}</span></span>
            <span className="snake-score-position">{finished ? <Flag size={13} aria-hidden="true" /> : <i aria-hidden="true" />}{player.connected === false ? 'Offline' : finished ? 'Finished' : player.position > 0 ? `Tile ${player.position}` : 'At start'}</span>
            <span className="snake-score-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, player.position / finalTile * 100))}%` }} /></span>
          </button>
        </li>;
      })}
    </ol>
  </header>;
}

type DockProps = { children?: ReactNode; muted: boolean; overhead: boolean; weaponOpen: boolean;
  watching: boolean; onMute: () => void; onCamera: () => void; onChat: () => void; onGift: () => void; onWeapon: () => void };

export function SnakeGameDock({ children, muted, overhead, weaponOpen, watching, onMute, onCamera, onChat, onGift, onWeapon }: DockProps) {
  return <div className="snake-game-dock">
    <nav className="snake-quick-actions" aria-label="Game actions">
      <button type="button" onClick={onChat}><MessageCircle size={18} aria-hidden="true" /><span>Chat</span></button>
      <button type="button" onClick={onGift}><Gift size={18} aria-hidden="true" /><span>Gift</span></button>
      <button type="button" onClick={onCamera} aria-label={overhead ? 'Switch to player view' : 'Switch to board view'} aria-pressed={overhead}><ScanLine size={18} aria-hidden="true" /><span>{overhead ? 'Player view' : 'Board view'}</span></button>
      {!watching && <button type="button" onClick={onWeapon} aria-label="Swap capture weapon" aria-expanded={weaponOpen}><RefreshCw size={18} aria-hidden="true" /><span>Loadout</span></button>}
      <button type="button" onClick={onMute} aria-label={muted ? 'Unmute game audio' : 'Mute game audio'} aria-pressed={muted}>{muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}<span>{muted ? 'Sound off' : 'Sound on'}</span></button>
    </nav>
    {children}
  </div>;
}
