'use client';
import { lazy, Suspense, useState, type ComponentProps } from 'react';
import { Game as OperationGame } from './operationUi';
import { CareerGame } from '../tiranastreets/career/CareerGame';
import '../tiranastreets/career/career.css';
import { GameModeBoundary } from '../shared/GameModeBoundary';
const StreetCareer = lazy(() =>
  import('../tiranastreets/street-career/StreetCareerGame').then((m) => ({
    default: m.StreetCareerGame
  }))
);
export * from './operationUi';
/** Mutually exclusive runtimes. Online never mounts or imports the solo campaign.
 * Existing ?activity=career keeps opening the courier/Dajti City Stories. */
export function Game(props: ComponentProps<typeof OperationGame>) {
  const [activity, setActivity] = useState(() => {
    const a =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('activity')
        : '';
    return a === 'street-career'
      ? 'street-career'
      : a === 'career'
        ? 'stories'
        : 'operation';
  });
  if (props.mode === 'online') return <OperationGame {...props} />;
  if (activity === 'stories')
    return (
      <GameModeBoundary onBack={() => setActivity('operation')}>
        <CareerGame onExit={() => setActivity('operation')} />
      </GameModeBoundary>
    );
  if (activity === 'street-career')
    return (
      <GameModeBoundary onBack={() => setActivity('operation')}>
        <Suspense
          fallback={
            <div className="tc-game">
              <p className="tc-status">Loading street career…</p>
            </div>
          }
        >
          <StreetCareer onExit={() => setActivity('operation')} />
        </Suspense>
      </GameModeBoundary>
    );
  return (
    <>
      <OperationGame {...props} />
      <div
        style={{
          position: 'fixed',
          right: 12,
          top: 148,
          zIndex: 40,
          display: 'grid',
          gap: 8
        }}
      >
        <button
          style={buttonStyle}
          onClick={() => setActivity('street-career')}
        >
          STREET CAREER · DRIVE + COMBAT
        </button>
        <button style={buttonStyle} onClick={() => setActivity('stories')}>
          CITY STORIES · COURIER + DAJTI
        </button>
      </div>
    </>
  );
}
const buttonStyle = {
  minHeight: 44,
  padding: '10px 14px',
  borderRadius: 9,
  background: '#193a45',
  color: '#eef4d8',
  border: '1px solid #91aca8'
};
