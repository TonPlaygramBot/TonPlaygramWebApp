import React, { useMemo, useState } from 'react';
import AmericanEightArenaScene from './American8/ArenaScene.jsx';
import TableConfig from './American8/TableConfig.jsx';
import { createAmericanEightRules } from './American8/RulesAdapter.ts';

const INITIAL_CONFIG = {
  preset: 'us8ft',
  clothColor: '#0f6130',
  railColor: '#3b2416',
  frameColor: '#6d4124',
  metalColor: '#d7d0c6',
  ballFinish: 'glossy'
};

export default function American8() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const rules = useMemo(() => createAmericanEightRules(), []);
  const [rulesState] = useState(() => rules.getState());

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#04070d] text-white">
      <AmericanEightArenaScene config={config} />
      <header className="absolute top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <div>
          <h1 className="text-base font-semibold tracking-wide">Pool Royale · American 8-Ball</h1>
          <p className="text-xs text-white/70">8 ft BCA table · 57.15 mm balls</p>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-20">
        <TableConfig config={config} onChange={setConfig} rulesState={rulesState} />
      </div>
    </div>
  );
}
