import { createContext, useContext } from 'react';

export const GameCallActionsContext = createContext(null);

// Media capture remains opt-in. No provider means no match call, not a global room.
export default function GameCallActions({ buttonClassName = '', iconClassName = '', labelClassName = '' }) {
  const call = useContext(GameCallActionsContext);
  if (!call) return null;
  return <div role="group" aria-label="Match voice and video" className="flex gap-2">
    {['audio', 'video'].map(mode => <button key={mode} type="button"
      disabled={!call.canStart} onClick={() => call.start(mode)} className={buttonClassName}
      aria-label={mode === 'audio' ? 'Start voice call' : 'Start video call'}>
      <span aria-hidden="true" className={iconClassName}>{mode === 'audio' ? '📞' : '📹'}</span>
      <span className={labelClassName}>{mode === 'audio' ? 'Voice' : 'Video'}</span>
    </button>)}
  </div>;
}
