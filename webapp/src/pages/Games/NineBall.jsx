import React, { useMemo, useState } from 'react';
import NineBallArenaScene from './NineBall/ArenaScene.jsx';
import TableConfig from './NineBall/TableConfig.jsx';
import { createNineBallRules } from './NineBall/RulesAdapter.ts';

const INITIAL_CONFIG = {
  preset: 'us9ft',
  clothColor: '#12539a',
  railColor: '#31211a',
  frameColor: '#553521',
  metalColor: '#d0d5df',
  ballFinish: 'glossy'
};

export default function NineBall() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const rules = useMemo(() => createNineBallRules(), []);
  const [rulesState] = useState(() => rules.getState());

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#03070f] text-white">
      <NineBallArenaScene config={config} />
      <header className="absolute top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <div>
          <h1 className="text-base font-semibold tracking-wide">Pool Royale · 9-Ball</h1>
          <p className="text-xs text-white/70">9 ft diamond rack · 57.15 mm set</p>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-20">
        <TableConfig config={config} onChange={setConfig} rulesState={rulesState} />
      </div>
    </div>
  );
}
