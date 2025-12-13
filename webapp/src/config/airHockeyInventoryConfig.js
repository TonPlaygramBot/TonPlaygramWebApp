export const AIR_HOCKEY_CUSTOMIZATION = Object.freeze({
  field: Object.freeze([
    Object.freeze({
      id: 'auroraIce',
      name: 'Aurora Ice',
      surface: '#3b83c3',
      lines: '#ffffff',
      rings: '#d8f3ff'
    }),
    Object.freeze({
      id: 'neonNight',
      name: 'Neon Night',
      surface: '#152238',
      lines: '#4de1ff',
      rings: '#9bf1ff'
    }),
    Object.freeze({
      id: 'sunsetClash',
      name: 'Sunset Clash',
      surface: '#c93f4b',
      lines: '#ffe8d0',
      rings: '#ffd1a1'
    }),
    Object.freeze({
      id: 'midnightSteel',
      name: 'Midnight Steel',
      surface: '#0f172a',
      lines: '#a1a1aa',
      rings: '#d4d4d8'
    }),
    Object.freeze({
      id: 'mintRush',
      name: 'Mint Rush',
      surface: '#0f766e',
      lines: '#d1fae5',
      rings: '#34d399'
    })
  ]),
  table: Object.freeze([
    Object.freeze({ id: 'walnut', name: 'Walnut', wood: '#5d3725', trim: '#2c1a11' }),
    Object.freeze({ id: 'ashGrey', name: 'Ash Grey', wood: '#6b7280', trim: '#111827' }),
    Object.freeze({ id: 'ivoryEdge', name: 'Ivory Edge', wood: '#f8fafc', trim: '#cbd5e1' }),
    Object.freeze({ id: 'obsidian', name: 'Obsidian', wood: '#0b0f1a', trim: '#1f2937' }),
    Object.freeze({ id: 'sapphire', name: 'Sapphire', wood: '#1d4ed8', trim: '#0f172a' })
  ]),
  puck: Object.freeze([
    Object.freeze({ id: 'carbon', name: 'Carbon', color: '#111111', emissive: '#1f2937' }),
    Object.freeze({ id: 'volt', name: 'Volt', color: '#eab308', emissive: '#854d0e' }),
    Object.freeze({ id: 'magenta', name: 'Magenta', color: '#be185d', emissive: '#9f1239' }),
    Object.freeze({ id: 'frost', name: 'Frost', color: '#e0f2fe', emissive: '#0ea5e9' }),
    Object.freeze({ id: 'jade', name: 'Jade', color: '#064e3b', emissive: '#10b981' })
  ]),
  mallet: Object.freeze([
    Object.freeze({ id: 'crimson', name: 'Crimson', color: '#ff5577', knob: '#1f2937' }),
    Object.freeze({ id: 'cyan', name: 'Cyan', color: '#22d3ee', knob: '#0f172a' }),
    Object.freeze({ id: 'amber', name: 'Amber', color: '#f59e0b', knob: '#451a03' }),
    Object.freeze({ id: 'violet', name: 'Violet', color: '#a855f7', knob: '#312e81' }),
    Object.freeze({ id: 'lime', name: 'Lime', color: '#84cc16', knob: '#1a2e05' })
  ]),
  rails: Object.freeze([
    Object.freeze({ id: 'glass', name: 'Glass', color: '#dbe9ff', opacity: 0.32 }),
    Object.freeze({ id: 'shadow', name: 'Shadow', color: '#0b1224', opacity: 0.6 }),
    Object.freeze({ id: 'coral', name: 'Coral', color: '#f97316', opacity: 0.4 }),
    Object.freeze({ id: 'mint', name: 'Mint', color: '#10b981', opacity: 0.35 }),
    Object.freeze({ id: 'frosted', name: 'Frosted', color: '#e5e7eb', opacity: 0.28 })
  ]),
  goals: Object.freeze([
    Object.freeze({ id: 'mintNet', name: 'Mint Net', color: '#99ffd6', emissive: '#1aaf80' }),
    Object.freeze({ id: 'crimsonNet', name: 'Crimson Net', color: '#ef4444', emissive: '#7f1d1d' }),
    Object.freeze({ id: 'cobaltNet', name: 'Cobalt Net', color: '#60a5fa', emissive: '#1d4ed8' }),
    Object.freeze({ id: 'amberNet', name: 'Amber Net', color: '#f59e0b', emissive: '#92400e' }),
    Object.freeze({ id: 'ghostNet', name: 'Ghost Net', color: '#e5e7eb', emissive: '#6b7280' })
  ])
});

const firstIds = Object.fromEntries(
  Object.entries(AIR_HOCKEY_CUSTOMIZATION).map(([key, options]) => [key, options?.[0]?.id])
);

export const AIR_HOCKEY_DEFAULT_UNLOCKS = Object.freeze(
  Object.entries(firstIds).reduce((acc, [key, id]) => {
    acc[key] = id ? [id] : [];
    return acc;
  }, {})
);

export const AIR_HOCKEY_OPTION_LABELS = Object.freeze(
  Object.entries(AIR_HOCKEY_CUSTOMIZATION).reduce((acc, [key, options]) => {
    acc[key] = Object.freeze(
      options.reduce((map, option) => {
        map[option.id] = option.name;
        return map;
      }, {})
    );
    return acc;
  }, {})
);

export const AIR_HOCKEY_STORE_ITEMS = [
  { id: 'field-neonNight', type: 'field', optionId: 'neonNight', name: 'Neon Night Rink', price: 480, description: 'Electric cyan lines on a dark rink glow.' },
  { id: 'field-sunsetClash', type: 'field', optionId: 'sunsetClash', name: 'Sunset Clash Rink', price: 520, description: 'Warm sunset cloth with soft ivory lines.' },
  { id: 'field-midnightSteel', type: 'field', optionId: 'midnightSteel', name: 'Midnight Steel Rink', price: 560, description: 'Slate midnight tones with metallic accents.' },
  { id: 'field-mintRush', type: 'field', optionId: 'mintRush', name: 'Mint Rush Rink', price: 600, description: 'Mint-emerald surface with bright rings.' },
  { id: 'table-ashGrey', type: 'table', optionId: 'ashGrey', name: 'Ash Grey Table', price: 360, description: 'Cool grey rails with dark charcoal trim.' },
  { id: 'table-ivoryEdge', type: 'table', optionId: 'ivoryEdge', name: 'Ivory Edge Table', price: 390, description: 'Ivory rails with soft silver edging.' },
  { id: 'table-obsidian', type: 'table', optionId: 'obsidian', name: 'Obsidian Table', price: 430, description: 'Deep obsidian rails with graphite trim.' },
  { id: 'table-sapphire', type: 'table', optionId: 'sapphire', name: 'Sapphire Table', price: 470, description: 'Royal blue rails with midnight trim.' },
  { id: 'puck-volt', type: 'puck', optionId: 'volt', name: 'Volt Puck', price: 220, description: 'High-voltage yellow puck glow.' },
  { id: 'puck-magenta', type: 'puck', optionId: 'magenta', name: 'Magenta Puck', price: 240, description: 'Magenta puck with vivid emissive edge.' },
  { id: 'puck-frost', type: 'puck', optionId: 'frost', name: 'Frost Puck', price: 260, description: 'Frost-white puck with cyan glow.' },
  { id: 'puck-jade', type: 'puck', optionId: 'jade', name: 'Jade Puck', price: 280, description: 'Deep jade puck with emerald shine.' },
  { id: 'mallet-cyan', type: 'mallet', optionId: 'cyan', name: 'Cyan Mallets', price: 260, description: 'Cyan mallets with midnight knobs.' },
  { id: 'mallet-amber', type: 'mallet', optionId: 'amber', name: 'Amber Mallets', price: 280, description: 'Amber mallets with dark wood knobs.' },
  { id: 'mallet-violet', type: 'mallet', optionId: 'violet', name: 'Violet Mallets', price: 300, description: 'Violet mallets with indigo knobs.' },
  { id: 'mallet-lime', type: 'mallet', optionId: 'lime', name: 'Lime Mallets', price: 320, description: 'Lime mallets with forest knobs.' },
  { id: 'rails-shadow', type: 'rails', optionId: 'shadow', name: 'Shadow Rails', price: 300, description: 'Smoked rails with higher opacity.' },
  { id: 'rails-coral', type: 'rails', optionId: 'coral', name: 'Coral Rails', price: 320, description: 'Coral rails with warm glow.' },
  { id: 'rails-mint', type: 'rails', optionId: 'mint', name: 'Mint Rails', price: 340, description: 'Mint rails with soft translucency.' },
  { id: 'rails-frosted', type: 'rails', optionId: 'frosted', name: 'Frosted Rails', price: 360, description: 'Frosted rails with light opacity.' },
  { id: 'goal-crimson', type: 'goals', optionId: 'crimsonNet', name: 'Crimson Net Goals', price: 330, description: 'Crimson goal nets with deep ember glow.' },
  { id: 'goal-cobalt', type: 'goals', optionId: 'cobaltNet', name: 'Cobalt Net Goals', price: 360, description: 'Cobalt nets with electric blue emissive.' },
  { id: 'goal-amber', type: 'goals', optionId: 'amberNet', name: 'Amber Net Goals', price: 390, description: 'Amber nets with warm metallic shine.' },
  { id: 'goal-ghost', type: 'goals', optionId: 'ghostNet', name: 'Ghost Net Goals', price: 420, description: 'Ghostly pale nets with steel glow.' }
];

export const AIR_HOCKEY_DEFAULT_LOADOUT = [
  { type: 'field', optionId: AIR_HOCKEY_CUSTOMIZATION.field[0].id, label: AIR_HOCKEY_CUSTOMIZATION.field[0].name },
  { type: 'table', optionId: AIR_HOCKEY_CUSTOMIZATION.table[0].id, label: AIR_HOCKEY_CUSTOMIZATION.table[0].name },
  { type: 'puck', optionId: AIR_HOCKEY_CUSTOMIZATION.puck[0].id, label: AIR_HOCKEY_CUSTOMIZATION.puck[0].name },
  { type: 'mallet', optionId: AIR_HOCKEY_CUSTOMIZATION.mallet[0].id, label: AIR_HOCKEY_CUSTOMIZATION.mallet[0].name },
  { type: 'rails', optionId: AIR_HOCKEY_CUSTOMIZATION.rails[0].id, label: AIR_HOCKEY_CUSTOMIZATION.rails[0].name },
  { type: 'goals', optionId: AIR_HOCKEY_CUSTOMIZATION.goals[0].id, label: AIR_HOCKEY_CUSTOMIZATION.goals[0].name }
];
