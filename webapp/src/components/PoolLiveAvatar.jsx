import { createContext, useContext } from 'react';

export const PoolLiveAvatarContext = createContext(null);

export default function PoolLiveAvatar({ seat, visible = true, ...photoProps }) {
  const call = useContext(PoolLiveAvatarContext);
  const photo = <img {...photoProps} data-pool-avatar={seat} />;
  if (!call || (call.previewOnly && seat === 'opponent')) return photo;

  const canStart = visible && call.canStart;
  const label = call.previewOnly
    ? 'Start camera preview'
    : seat === 'self' ? 'Turn on live avatar video' : 'Start video call with opponent';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!canStart}
      onClick={call.startVideo}
      className={`relative flex shrink-0 items-center justify-center rounded-full touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-200 ${canStart ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        width: photoProps.style?.width,
        height: photoProps.style?.height,
        padding: 0,
        border: 0,
        background: 'none',
        boxShadow: 'none'
      }}
    >
      {photo}
      {canStart && seat === 'self' && (
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white shadow">
          📹
        </span>
      )}
    </button>
  );
}
