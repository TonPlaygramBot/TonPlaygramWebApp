import React, { useEffect, useMemo, useState } from 'react';

const VARIANT_CONFIGS = Object.freeze({
  uk: {
    key: 'uk',
    documentTitle: 'Pool Royale • 8-Ball UK (3D)',
    strings: {
      gameName: '8 Pool UK',
      scoreboardTitle: 'Pool Royale — 8-Ball UK',
      broadcastTitle: '8-Ball UK Showdown'
    },
    table: {
      widthRef: 2540,
      heightRef: 1270,
      ballDiameter: 57.15,
      cornerMouth: 114,
      sideMouth: 137,
      blackFromTop: 324,
      dRadius: 292,
      baulkFromBaulk: 737
    },
    scale: {
      sizeReduction: 0.74,
      table: 1.12,
      world: 0.74
    },
    defaultFinish: 'goldenMaple',
    ballColors: {
      cue: 0xffffff,
      red: 0xff2222,
      yellow: 0xf6d433,
      green: 0xffffff,
      brown: 0xffffff,
      blue: 0xffffff,
      pink: 0xffffff,
      black: 0x000000
    }
  },
  '9ball': {
    key: '9ball',
    documentTitle: 'Pool Royale • 9-Ball (3D)',
    strings: {
      gameName: '9-Ball',
      scoreboardTitle: 'Pool Royale — 9-Ball',
      broadcastTitle: '9-Ball Championship'
    },
    table: {
      widthRef: 2540,
      heightRef: 1270,
      ballDiameter: 57.15,
      cornerMouth: 114,
      sideMouth: 137,
      blackFromTop: 324,
      dRadius: 292,
      baulkFromBaulk: 737
    },
    scale: {
      sizeReduction: 0.74,
      table: 1.12,
      world: 0.74
    },
    defaultFinish: 'matteGraphite',
    ballColors: {
      cue: 0xffffff,
      red: 0xffc107,
      yellow: 0x14a8ff,
      green: 0xff00ff,
      brown: 0x34c759,
      blue: 0xff5722,
      pink: 0x8e44ad,
      black: 0xffff00
    }
  },
  american: {
    key: 'american',
    documentTitle: 'Pool Royale • American Billiards (3D)',
    strings: {
      gameName: 'American Billiards',
      scoreboardTitle: 'Pool Royale — American Billiards',
      broadcastTitle: 'American Billiards Prime Time'
    },
    table: {
      widthRef: 2540,
      heightRef: 1270,
      ballDiameter: 57.15,
      cornerMouth: 120,
      sideMouth: 143,
      blackFromTop: 324,
      dRadius: 292,
      baulkFromBaulk: 737
    },
    scale: {
      sizeReduction: 0.74,
      table: 1.15,
      world: 0.74
    },
    defaultFinish: 'midnightOnyx',
    ballColors: {
      cue: 0xffffff,
      red: 0xff4136,
      yellow: 0xffdc00,
      green: 0x2ecc40,
      brown: 0xff851b,
      blue: 0x0074d9,
      pink: 0xb10dc9,
      black: 0x111111
    }
  }
});

function useSnookerVariant(config) {
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const previousConfig = globalThis.__SNOOKER_VARIANT_CONFIG__;
    globalThis.__SNOOKER_VARIANT_CONFIG__ = config;

    import('./Snooker.jsx').then((module) => {
      if (cancelled) return;
      const Game = module.default ?? module.NewSnookerGame;
      setComponent(() => Game);
    });

    return () => {
      cancelled = true;
      if (previousConfig === undefined) {
        delete globalThis.__SNOOKER_VARIANT_CONFIG__;
      } else {
        globalThis.__SNOOKER_VARIANT_CONFIG__ = previousConfig;
      }
    };
  }, [config]);

  return Component;
}

export default function PoolRoyale3D({ variant }) {
  const config = useMemo(
    () => ({
      ...(VARIANT_CONFIGS[variant] ?? VARIANT_CONFIGS.uk)
    }),
    [variant]
  );
  const Component = useSnookerVariant(config);

  if (!Component) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#0f1b2d] text-white">
        <span className="text-lg font-semibold">Duke ngarkuar arenën 3D…</span>
      </div>
    );
  }

  return <Component />;
}
