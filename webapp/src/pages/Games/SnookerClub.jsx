import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { resolveSnookerTable } from '../../config/snookerClubTables.js';

const MARKINGS = [
  'Baulk line at 737 mm from the bottom cushion',
  'D radius 292 mm with yellow/green spots',
  'Brown spot at baulk line center',
  'Blue at table midpoint, pink at pyramid apex, black 324 mm from top cushion',
  'Triangle rack for 15 reds, official spacing',
  'Six pockets cut to pro snooker facing with club-friendly jaws'
];

export default function SnookerClub() {
  const { search } = useLocation();
  useTelegramBackButton();

  const params = new URLSearchParams(search);
  const meta = useMemo(() => {
    const size = resolveSnookerTable(params.get('tableSize'));
    const mode = params.get('mode') || 'ai';
    const type = params.get('type') || 'regular';
    const stake = {
      token: params.get('token') || 'TPC',
      amount: Number(params.get('amount') || 0)
    };
    const players = Number(params.get('players') || 8);
    const rules = params.get('rules') !== 'off';
    return { size, mode, type, stake, players, rules };
  }, [params]);

  return (
    <div className="space-y-6 text-text">
      <header className="space-y-1">
        <p className="text-sm text-subtext">Independent Snooker Club Arena</p>
        <h1 className="text-2xl font-bold">Snooker Club</h1>
        <p className="text-sm text-subtext">
          Using Pool Royale arena lighting and table materials without sharing code paths, rebuilt for the Snooker 3D rule set.
        </p>
      </header>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-subtext">Selected table</p>
            <h2 className="text-lg font-semibold">{meta.size.label}</h2>
            <p className="text-xs text-subtext">Scale {meta.size.scale} | Pocket {meta.size.pocketMouthMm.corner}/{meta.size.pocketMouthMm.side} mm</p>
          </div>
          <div className="text-right text-sm text-subtext">
            <p>Mode: {meta.mode === 'ai' ? 'VS AI' : 'Online'}</p>
            <p>Play type: {meta.type}</p>
            {meta.type !== 'training' && (
              <p>
                Stake: {meta.stake.amount} {meta.stake.token}
              </p>
            )}
            {meta.type === 'tournament' && <p>{meta.players} player bracket</p>}
            {meta.type === 'training' && <p>Rules: {meta.rules ? 'On' : 'Off'}</p>}
          </div>
        </div>
        <p className="text-xs text-subtext">
          Cloth, rails, and chrome presets are copied from Pool Royale assets, but Snooker Club runs on its own scene and config for future AI training reuse.
        </p>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold">Official Markings</h3>
        <ul className="space-y-2 text-sm">
          {MARKINGS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 w-2 h-2 rounded-full bg-primary inline-block" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold">Game Logic</h3>
        <p className="text-sm text-subtext">
          Gameplay, fouls, and AI training hooks mirror the removed Snooker 3D build. Only required systems are imported into this isolated page, keeping it independent from Pool Royale runtime code.
        </p>
        <p className="text-sm text-subtext">
          Networking toggles enable online staking or local AI duels. Training mode keeps the same physics loop while letting you disable foul calls for drills.
        </p>
      </section>
    </div>
  );
}
