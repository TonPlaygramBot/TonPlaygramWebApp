import React, { useMemo, useState } from 'react';
import PoolUK8ArenaScene from './PoolUK8/ArenaScene.jsx';
import TableConfig from './PoolUK8/TableConfig.jsx';
import { createPoolUk8Rules } from './PoolUK8/RulesAdapter.ts';

const INITIAL_CONFIG = {
  preset: 'uk7ft',
  clothColor: '#0c5f31',
  railColor: '#362219',
  frameColor: '#6f4122',
  metalColor: '#d3cec4',
  ballFinish: 'glossy'
};

export default function PoolUK8() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const rules = useMemo(() => createPoolUk8Rules(), []);
  const [rulesState] = useState(() => rules.getState());

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#04070d] text-white">
      <PoolUK8ArenaScene config={config} />
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <div>
          <h1 className="text-base font-semibold tracking-wide">Pool Royale · UK 8-Ball</h1>
          <p className="text-xs text-white/70">Official 7 ft table with 50.8 mm balls</p>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-20">
        <TableConfig config={config} onChange={setConfig} rulesState={rulesState} />
      </div>
    </div>
  );
}
