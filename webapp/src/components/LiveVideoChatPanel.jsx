import React from 'react';

function AvatarFallback({ avatarUrl, label, doubleSize = false }) {
  const sizeClass = doubleSize ? 'h-20 w-20 text-2xl' : 'h-10 w-10 text-sm';
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${label} avatar`}
        className={`${sizeClass} rounded-full border border-white/30 object-cover shadow-[0_8px_20px_rgba(0,0,0,0.45)]`}
      />
    );
  }
  const fallbackInitial = (label || '?').slice(0, 1).toUpperCase();
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full border border-white/30 bg-slate-800/80 font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.45)]`}>
      {fallbackInitial}
    </div>
  );
}

function VideoTile({ title, stream, muted = false, mediaState, mirror = false, avatarUrl }) {
  const videoRef = React.useRef(null);
  const showAvatar = !stream || mediaState?.camera === false;

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
      {showAvatar ? (
        <div className="flex h-24 w-full items-center justify-center rounded-lg bg-black/80">
          <AvatarFallback avatarUrl={avatarUrl} label={title} doubleSize />
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-24 w-full rounded-lg bg-black object-cover ${mirror ? 'scale-x-[-1]' : ''}`}
        />
      )}
    </div>
  );
}

export default function LiveVideoChatPanel({
  open,
  onClose,
  roomId,
  localVideoRef,
  localMediaState,
  remotePeers,
  isConnected,
  error,
  onStart,
  onStop,
  onToggleMicrophone,
  onToggleCamera,
  localAvatarUrl,
  remoteAvatarLookup = {}
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-white shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em]">Live Chat</h3>
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
            {localMediaState?.camera === false ? (
              <div className="flex h-24 w-full items-center justify-center rounded-lg bg-black/80">
                <AvatarFallback avatarUrl={localAvatarUrl} label="You" doubleSize />
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-24 w-full rounded-lg bg-black object-cover scale-x-[-1]"
              />
            )}
          </div>
          {remotePeers.length > 0 ? (
            remotePeers.map((peer) => (
              <VideoTile
                key={peer.socketId}
                title={peer.displayName || 'Player'}
                stream={peer.stream}
                mediaState={peer.mediaState}
                avatarUrl={remoteAvatarLookup[peer.socketId]}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/20 p-2 text-center text-xs text-white/60">
              Waiting for other players to join live chat…
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
              Start live chat
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
                Leave live chat
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
