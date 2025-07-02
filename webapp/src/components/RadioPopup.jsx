import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';

const stations = [
  { name: 'Capital FM (London)', url: 'https://media-ssl.musicradio.com/CapitalMP3' },
  { name: 'Paris Jazz Café', url: 'https://radiospinner.com/radio/paris-jazz-cafe/stream' },
  { name: '103.5 KTU (New York)', url: 'https://n12a-e2.revma.ihrhls.com/zc2743' },
  { name: 'J1 Radio (Tokyo)', url: 'https://j1.stream/hi.mp3' },
  { name: 'Top Albania Radio', url: 'https://live.topalbaniaradio.com:8000/live.mp3' },
];

export default function RadioPopup({ open, onClose }) {
  const audioRefs = useRef([]);
  const [mutedAll, setMutedAll] = useState(false);

  if (!open) return null;

  const play = i => audioRefs.current[i]?.play();
  const pause = i => audioRefs.current[i]?.pause();
  const stop = i => {
    const a = audioRefs.current[i];
    if (a) { a.pause(); a.currentTime = 0; }
  };
  const toggleMute = i => {
    const a = audioRefs.current[i];
    if (a) a.muted = !a.muted;
  };
  const stopAll = () => audioRefs.current.forEach(a => { if (a) { a.pause(); a.currentTime = 0; } });
  const toggleMuteAll = () => {
    const newVal = !mutedAll;
    setMutedAll(newVal);
    audioRefs.current.forEach(a => { if (a) a.muted = newVal; });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface p-4 w-80 space-y-4 relative rounded">
        <button onClick={onClose} className="absolute -top-3 -right-3 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center">
          <X size={14} />
        </button>
        <h3 className="text-center font-bold">Radio Stations</h3>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {stations.map((s, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-semibold">{s.name}</p>
              <audio ref={el => audioRefs.current[i] = el} src={s.url} className="w-full" />
              <div className="flex items-center justify-between text-xs">
                <button onClick={() => play(i)}>Play</button>
                <button onClick={() => pause(i)}>Pause</button>
                <button onClick={() => stop(i)}>Stop</button>
                <button onClick={() => toggleMute(i)}>Mute</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 text-xs">
          <button onClick={stopAll}>Stop All</button>
          <button onClick={toggleMuteAll}>{mutedAll ? 'Unmute All' : 'Mute All'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
