import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

function Video({ stream, muted = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

export default function FriendCallOverlay({ call, displayName, onEnd }) {
  const chat = useLiveVideoChat({
    roomId: call?.roomId,
    displayName,
    enabled: !!call,
    video: call?.type === 'video'
  });

  useEffect(() => {
    if (call) chat.startLiveChat();
  }, [call?.roomId]); // start once for this call

  if (!call) return null;
  const remote = chat.remotePeers[0];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#07101d] text-white" role="dialog" aria-label={`${call.type} call`}>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {call.type === 'video' && remote?.stream ? (
          <Video stream={remote.stream} className="h-full w-full object-cover" />
        ) : (
          <div className="text-center px-6">
            <img src={call.photo || '/assets/icons/profile.svg'} alt="" className="mx-auto h-28 w-28 rounded-full border-4 border-cyan-400 object-cover shadow-xl" />
            <h2 className="mt-4 text-2xl font-bold">{call.name || 'Friend'}</h2>
            <p className="mt-2 text-white/60">{remote ? 'Connected' : 'Connecting…'}</p>
          </div>
        )}
        {call.type === 'video' && chat.localStream && (
          <Video stream={chat.localStream} muted className="absolute right-3 top-3 h-36 w-24 rounded-2xl border-2 border-white/40 bg-black object-cover shadow-xl" />
        )}
      </div>
      {chat.error && <p className="bg-red-950 px-4 py-2 text-center text-sm text-red-200">{chat.error}</p>}
      <div className="flex justify-center gap-5 bg-black/40 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        <button onClick={chat.toggleMicrophone} className="rounded-full bg-white/15 p-4" aria-label="Toggle microphone">
          {chat.mediaState.microphone ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </button>
        {call.type === 'video' && <button onClick={chat.toggleCamera} className="rounded-full bg-white/15 p-4" aria-label="Toggle camera">
          {chat.mediaState.camera ? <FaVideo /> : <FaVideoSlash />}
        </button>}
        <button onClick={() => { chat.stopLiveChat(); onEnd(); }} className="rounded-full bg-red-600 p-4" aria-label="End call"><FaPhoneSlash /></button>
      </div>
    </div>, document.body
  );
}
