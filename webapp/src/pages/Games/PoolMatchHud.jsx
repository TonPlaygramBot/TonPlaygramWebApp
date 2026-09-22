import React from 'react';
import './poolMatchHud.css';

export function PoolMatchHud({ player, opponent, turn, target, busy, preparing = false, inHand, timer, variant,
  competition, declaration, automaticCall, canCall, canPushOut, interactive, callOpen,
  onToggleCall, onDeclaration, availableBalls }) {
  const callBall = declaration.ballId ?? automaticCall.ballId;
  const callPocket = declaration.pocket ?? automaticCall.pocket;
  const pocketNumber = ['TL', 'TR', 'BL', 'BR', 'TM', 'BM'].indexOf(callPocket) + 1;
  return <section className="pool-match-hud" data-competition={Boolean(competition)} aria-label="Pool match scoreboard">
    <div className="pool-match-hud__meta">
      <span>{competition ? `Round ${(competition.round ?? 0) + 1} · Race to ${competition.raceTo}` : `${variant} · Pool Royal`}</span>
      <span aria-live="polite">{preparing ? 'Taking position…' : busy ? 'Balls in play' : inHand ? 'Ball in hand' : turn === 0 ? 'Your visit' : 'Opponent visit'}</span>
    </div>
    <div className="pool-match-hud__players">
      <span className={turn === 0 ? 'is-active' : ''}>{player}</span>
      <strong>{competition ? `${competition.frames?.[0] ?? 0} : ${competition.frames?.[1] ?? 0}` : 'VS'}</strong>
      <span className={turn === 1 ? 'is-active' : ''}>{opponent}</span>
    </div>
    <div className="pool-match-hud__target">
      <span><i /> {preparing ? 'Planting feet and lining up' : inHand ? 'Place cue ball, then aim' : `Ball on: ${target}`}</span>
      <span>{preparing ? 'Shot queued' : busy ? 'Watching shot' : `${Math.max(0, timer)}s`}</span>
    </div>
    {!busy && interactive && (canCall || canPushOut) && <div className="pool-match-hud__actions">
      {canCall && <>
        <button type="button" aria-expanded={callOpen} onClick={onToggleCall}>
          {callBall && callPocket ? `Call ${String(callBall).replace(/^BALL_/i, '')} · ${pocketNumber}` : 'Call shot'}
        </button>
        <button type="button" aria-pressed={declaration.safety} onClick={() => onDeclaration({ safety: !declaration.safety, pushOut: false })}>Safety</button>
      </>}
      {canPushOut && <button type="button" aria-pressed={declaration.pushOut} onClick={() => onDeclaration({ pushOut: !declaration.pushOut, safety: false })}>Push out</button>}
    </div>}
    {callOpen && interactive && !busy && <div className="pool-match-hud__call">
      <label>Called ball <select value={declaration.ballId ?? ''} onChange={event => onDeclaration({ ballId: event.target.value || null, safety: false })}>
        <option value="">Use aiming target</option>
        {availableBalls.map(ball => <option key={ball.id} value={ball.id}>{String(ball.id).replace(/^BALL_/i, '')}</option>)}
      </select></label>
      <p>Tap a numbered pocket on the table. White: aim · gold: object ball · dashed cyan: cue-ball estimate.</p>
      <button type="button" onClick={() => onDeclaration({ ballId: null, pocket: null })}>Use automatic call</button>
    </div>}
  </section>;
}
