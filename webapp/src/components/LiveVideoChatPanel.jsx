import React from 'react';

function VideoTile({ title, stream, muted = false, mediaState, mirror = false, avatar }) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="rounded-xl border border-white/15 bg-black/60 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/70">
        <span className="truncate">{title}</span>
        <span>{mediaState?.microphone === false ? '🎙️ Off' : '🎙️ On'} · {mediaState?.camera === false ? '📷 Off' : '📷 On'}</span>
      </div>
      <div className="relative h-24 w-full rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full rounded-lg bg-black object-cover ${mirror ? 'scale-x-[-1]' : ''} ${mediaState?.camera === false ? 'opacity-0' : 'opacity-100'}`}
        />
        {mediaState?.camera === false && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveVideoChatPanel({
  open,
  onClose,
  roomId,
  localVideoRef,
  localAvatar,
  localMediaState,
  remotePeers,
  isConnected,
  error,
  onStart,
  onStop,
  onToggleMicrophone,
  onToggleCamera
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em]">Live</h3>
            <p className="text-[10px] text-white/60">Room: {roomId}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error ? <p className="mb-2 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100">{error}</p> : null}

        <div className="space-y-2">
          <div className="rounded-xl border border-white/15 bg-black/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/70">
              <span>You</span>
              <span>{localMediaState?.microphone === false ? '🎙️ Off' : '🎙️ On'} · {localMediaState?.camera === false ? '📷 Off' : '📷 On'}</span>
            </div>
            <div className="relative h-24 w-full rounded-lg bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full rounded-lg bg-black object-cover scale-x-[-1] ${localMediaState?.camera === false ? 'opacity-0' : 'opacity-100'}`}
              />
              {localMediaState?.camera === false && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src={localAvatar} alt="" className="h-16 w-16 rounded-full object-cover" />
                </div>
              )}
            </div>
          </div>
          {remotePeers.length > 0 ? (
            remotePeers.map((peer) => (
              <VideoTile
                key={peer.socketId}
                title={peer.displayName || 'Player'}
                stream={peer.stream}
                mediaState={peer.mediaState}
                avatar={peer.avatar}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/20 p-2 text-center text-xs text-white/60">
              Waiting for other players to join live…
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isConnected ? (
            <button
              type="button"
              onClick={onStart}
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              Start live
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
                Leave live
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
