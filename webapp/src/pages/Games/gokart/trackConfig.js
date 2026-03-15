export const GOKART_TRACKS = [
  {
    id: 'lighthouse',
    label: 'Lighthouse Loop',
    laps: 3,
    color: '#0ea5e9',
    description: 'Balanced turns for quick onboarding.'
  },
  {
    id: 'desert',
    label: 'Desert Drift',
    laps: 4,
    color: '#f59e0b',
    description: 'Long straights with tighter control windows.'
  },
  {
    id: 'snow',
    label: 'Snow Sprint',
    laps: 5,
    color: '#38bdf8',
    description: 'Fast loop focused on rhythm and reaction.'
  }
];

export const TRACKS_BY_ID = Object.freeze(
  GOKART_TRACKS.reduce((acc, track) => {
    acc[track.id] = track;
    return acc;
  }, {})
);
