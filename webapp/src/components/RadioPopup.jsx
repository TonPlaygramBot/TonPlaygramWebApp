import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  stations,
  play,
  pause,
  stop,
  getCurrent,
  getVolume,
  setVolume,
} from '../utils/radio.js';
import { isGameMuted, toggleGameMuted, getGameVolume, setGameVolume } from '../utils/sound.js';

export default function RadioPopup({ open, onClose }) {
  const [selected, setSelected] = useState(getCurrent() || stations[0].url);
  const [playing, setPlaying] = useState(false);
  const [radioVolume, setRadioVolume] = useState(getVolume());
  const [gameVolume, setGameVolumeState] = useState(getGameVolume());
  const [radioMuted, setRadioMuted] = useState(getVolume() === 0);
  const [gameMuted, setGameMutedState] = useState(isGameMuted());

  useEffect(() => {
    setGameMutedState(isGameMuted());
    setGameVolumeState(getGameVolume());
    const v = getVolume();
    setRadioVolume(v);
    setRadioMuted(v === 0);
  }, [open]);

  if (!open) return null;

  const handlePlay = () => {
    play(selected);
    setPlaying(true);
  };
  const handlePause = () => {
    pause();
    setPlaying(false);
  };
  const handleStop = () => {
    stop();
    setPlaying(false);
  };
  const handleRadioVolume = (e) => {
    const v = parseFloat(e.target.value);
    setRadioVolume(v);
    setVolume(v);
    setRadioMuted(v === 0);
  };
  const handleGameVolume = (e) => {
    const v = parseFloat(e.target.value);
    setGameVolumeState(v);
    setGameVolume(v);
    if (v === 0) toggleGameMuted();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface p-4 w-80 space-y-4 relative rounded">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          <X size={14} />
        </button>
        <h3 className="text-center font-bold">Radio Stations</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {stations.map((s) => (
            <label key={s.url} className="flex items-center space-x-2">
              <input
                type="radio"
                name="station"
                value={s.url}
                checked={selected === s.url}
                onChange={() => setSelected(s.url)}
              />
              <span className="text-sm font-semibold">{s.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-center space-x-4 pt-2 text-xl">
          <button onClick={handlePlay}>▶️</button>
          <button onClick={handlePause}>⏸️</button>
          <button onClick={handleStop}>⏹️</button>
        </div>
        <div className="flex justify-around pt-2 text-xs">
          <div className="flex flex-col items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={radioVolume}
              onChange={handleRadioVolume}
              className="h-24 rotate-[-90deg]"
            />
            <span>{radioMuted ? '🔇' : '🔊'} Radio</span>
          </div>
          <div className="flex flex-col items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gameVolume}
              onChange={handleGameVolume}
              className="h-24 rotate-[-90deg]"
            />
            <span>{gameMuted ? '🔇' : '🔊'} Game</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
