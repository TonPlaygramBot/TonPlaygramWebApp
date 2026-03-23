import React from 'react';

export default function LocalMediaPanel({
  open,
  onClose,
  stream,
  mediaState,
  isActive,
  error,
  onStart,
  onStop,
  onToggleMicrophone,
  onToggleCamera,
  title = 'Live Camera & Mic'
}) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
  }, [stream]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">{title}</h3>
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error ? <p className="mb-2 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100">{error}</p> : null}

        <div className="rounded-xl border border-white/15 bg-black/60 p-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/70">
            <span>You</span>
            <span>{mediaState?.microphone === false ? '🎙️ Off' : '🎙️ On'} · {mediaState?.camera === false ? '📷 Off' : '📷 On'}</span>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-28 w-full rounded-lg bg-black object-cover scale-x-[-1]"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isActive ? (
            <button
              type="button"
              onClick={onStart}
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              Start camera & mic
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleMicrophone}
                className="rounded-full border border-white/25 px-3 py-1 text-xs hover:bg-white/10"
              >
                Toggle mic
              </button>
              <button
                type="button"
                onClick={onToggleCamera}
                className="rounded-full border border-white/25 px-3 py-1 text-xs hover:bg-white/10"
              >
                Toggle camera
              </button>
              <button
                type="button"
                onClick={onStop}
                className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-400"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
