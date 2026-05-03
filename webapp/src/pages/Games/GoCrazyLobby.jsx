import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

export default function GoCrazyLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [mode, setMode] = useState('ai');
  const [players, setPlayers] = useState(2);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [trackId, setTrackId] = useState('sunset-gp');
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';
  const trackOptions = [
    { id: 'sunset-gp', label: 'Sunset GP' },
    { id: 'forest-bend', label: 'Forest Bend' },
    { id: 'coastal-loop', label: 'Coastal Loop' },
    { id: 'night-curve', label: 'Night Curve' },
    { id: 'desert-sprint', label: 'Desert Sprint' }
  ];

  const start = () => {
    const params = new URLSearchParams(search);
    params.set('mode', mode);
    params.set('players', String(players));
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    params.set('track', trackId);
    navigate(`/games/gocrazy?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="gocrazy" title="Go Crazy Lobby" badge="Race setup" />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-sm text-white/80">Choose game mode, player count (2-8), and world flags as avatars.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setMode('ai')} className={`lobby-option-card ${mode==='ai'?'lobby-option-card-active':'lobby-option-card-inactive'}`}>VS AI</button>
            <button onClick={() => setMode('online')} className={`lobby-option-card ${mode==='online'?'lobby-option-card-active':'lobby-option-card-inactive'}`}>Online</button>
          </div>
          <div className="mt-3">
            <label className="text-xs text-white/60">Players: {players}</label>
            <input type="range" min={2} max={8} value={players} onChange={(e)=>setPlayers(Number(e.target.value))} className="w-full" />
          </div>
          <div className="mt-3">
            <label className="text-xs text-white/60">Track layout</label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {trackOptions.map((item) => (
                <button key={item.id} onClick={() => setTrackId(item.id)} className={`lobby-option-card ${trackId===item.id?'lobby-option-card-active':'lobby-option-card-inactive'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button onClick={()=>setShowFlagPicker(true)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-white/80">Your Flag: {selectedFlag || '🌐'}</button>
            <button onClick={()=>setShowAiFlagPicker(true)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-white/80">Opponent Flag: {selectedAiFlag || '🌐'}</button>
          </div>
          <button onClick={start} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-black">Start Go Crazy</button>
        </div>
      </div>
      <FlagPickerModal open={showFlagPicker} onClose={() => setShowFlagPicker(false)} selected={playerFlagIndex != null ? [playerFlagIndex] : []} onSave={(arr) => { setPlayerFlagIndex(arr[0] ?? null); setShowFlagPicker(false); }} limit={1} title="Choose your flag avatar" />
      <FlagPickerModal open={showAiFlagPicker} onClose={() => setShowAiFlagPicker(false)} selected={aiFlagIndex != null ? [aiFlagIndex] : []} onSave={(arr) => { setAiFlagIndex(arr[0] ?? null); setShowAiFlagPicker(false); }} limit={1} title="Choose opponent flag avatar" />
    </div>
  );
}
