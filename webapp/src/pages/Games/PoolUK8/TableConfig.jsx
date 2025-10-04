import React, { useMemo } from 'react';
import {
  TABLE_DIMENSIONS_MM,
  BALL_DIAMETER_MM,
  POCKET_RADIUS_MM,
  mmToMeters
} from './BallSet.ts';

const PRESETS = Object.freeze({
  uk7ft: {
    label: 'UK 7 ft',
    clothColor: '#0c5f31',
    railColor: '#362219',
    frameColor: '#6f4122',
    metalColor: '#d3cec4'
  },
  club: {
    label: 'Club Warm Oak',
    clothColor: '#0a4c28',
    railColor: '#3c2419',
    frameColor: '#8a5632',
    metalColor: '#ede7dd'
  },
  tour: {
    label: 'TV Tour Blue',
    clothColor: '#1b5fa6',
    railColor: '#2c1c14',
    frameColor: '#4b3224',
    metalColor: '#d7d9de'
  }
});

const BALL_FINISHES = [
  { id: 'glossy', label: 'Glossy' },
  { id: 'satin', label: 'Satin' }
];

export default function TableConfig({ config, onChange, rulesState }) {
  const presetId = config?.preset ?? 'uk7ft';
  const activePreset = PRESETS[presetId] ?? PRESETS.uk7ft;

  const metrics = useMemo(() => {
    const lengthM = mmToMeters(TABLE_DIMENSIONS_MM.length).toFixed(3);
    const widthM = mmToMeters(TABLE_DIMENSIONS_MM.width).toFixed(3);
    const ballM = mmToMeters(BALL_DIAMETER_MM).toFixed(3);
    const pocketM = mmToMeters(POCKET_RADIUS_MM).toFixed(3);
    return { lengthM, widthM, ballM, pocketM };
  }, []);

  const updateConfig = (patch) => {
    onChange?.({ ...config, ...patch });
  };

  const handlePreset = (event) => {
    const id = event.target.value;
    const preset = PRESETS[id] ?? PRESETS.uk7ft;
    updateConfig({
      preset: id,
      clothColor: preset.clothColor,
      railColor: preset.railColor,
      frameColor: preset.frameColor,
      metalColor: preset.metalColor
    });
  };

  return (
    <div className="bg-[#05080f]/95 backdrop-blur text-white text-sm px-4 py-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wide text-white/60">Table preset</label>
        <select
          value={presetId}
          onChange={handlePreset}
          className="bg-black/40 border border-white/10 rounded px-3 py-2"
        >
          {Object.entries(PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ColorInput
          label="Cloth"
          value={config?.clothColor ?? activePreset.clothColor}
          onChange={(value) => updateConfig({ clothColor: value })}
        />
        <ColorInput
          label="Rails"
          value={config?.railColor ?? activePreset.railColor}
          onChange={(value) => updateConfig({ railColor: value })}
        />
        <ColorInput
          label="Frame"
          value={config?.frameColor ?? activePreset.frameColor}
          onChange={(value) => updateConfig({ frameColor: value })}
        />
        <ColorInput
          label="Chrome"
          value={config?.metalColor ?? activePreset.metalColor}
          onChange={(value) => updateConfig({ metalColor: value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wide text-white/60">Ball finish</label>
        <div className="flex gap-2">
          {BALL_FINISHES.map((finish) => {
            const active = (config?.ballFinish ?? 'glossy') === finish.id;
            return (
              <button
                key={finish.id}
                onClick={() => updateConfig({ ballFinish: finish.id })}
                className={`flex-1 rounded px-3 py-2 border text-center transition-colors ${
                  active ? 'border-white bg-white/10' : 'border-white/10 bg-black/30'
                }`}
                type="button"
              >
                {finish.label}
              </button>
            );
          })}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-white/80 text-xs">
        <div>
          <dt className="uppercase tracking-wide text-[10px] text-white/50">Playfield</dt>
          <dd>
            {metrics.lengthM} m × {metrics.widthM} m
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-[10px] text-white/50">Ball diameter</dt>
          <dd>{metrics.ballM} m</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-[10px] text-white/50">Pocket radius</dt>
          <dd>{metrics.pocketM} m</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-[10px] text-white/50">Current player</dt>
          <dd>{rulesState?.currentPlayer ?? 'A'}</dd>
        </div>
      </dl>
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="uppercase tracking-wide text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-10 h-8 rounded border border-white/20 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1"
        />
      </div>
    </label>
  );
}
