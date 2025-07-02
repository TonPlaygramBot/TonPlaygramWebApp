import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  stations,
  play,
  pause,
  stop,
  getCurrent,
  setVolume,
} from '../utils/radio.js';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';

export default function RadioPopup({ open, onClose }) {
  const [selected, setSelected] = useState(getCurrent() || stations[0].url);
  const [playing, setPlaying] = useState(false);
  const [radioMuted, setRadioMuted] = useState(false);
  const [gameMuted, setGameMutedState] = useState(isGameMuted());

  useEffect(() => {
    setGameMutedState(isGameMuted());
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
  const toggleRadioMute = () => {
    const newVal = !radioMuted;
    setRadioMuted(newVal);
    // volume 0 or 1
    setVolume(newVal ? 0 : 1);
  };
  const toggleGameMute = () => {
    toggleGameMuted();
    setGameMutedState(isGameMuted());
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
          <button onClick={toggleRadioMute} className="flex flex-col items-center">
            <span>{radioMuted ? '🔇' : '🔊'}</span>
            <span>Radio</span>
          </button>
          <button onClick={toggleGameMute} className="flex flex-col items-center">
            <span>{gameMuted ? '🔇' : '🔊'}</span>
            <span>Game</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
