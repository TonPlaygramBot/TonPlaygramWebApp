export const TABLE_SIZE_OPTIONS = Object.freeze({
  '9ft': {
    id: '9ft',
    label: '9 ft',
    scale: 1.44,
    mobileScale: 1.44,
    compactScale: 1.44
  },
  '10ft': {
    id: '10ft',
    label: '10 ft',
    scale: 1.6,
    mobileScale: 1.44,
    compactScale: 1.36
  }
});

export const DEFAULT_TABLE_SIZE_ID = '9ft';

export function resolveTableSize(sizeId) {
  const key = typeof sizeId === 'string' ? sizeId.toLowerCase() : '';
  return TABLE_SIZE_OPTIONS[key] || TABLE_SIZE_OPTIONS[DEFAULT_TABLE_SIZE_ID];
}

export const TABLE_SIZE_LIST = Object.freeze(
  Object.values(TABLE_SIZE_OPTIONS).map(({ id, label }) => ({ id, label }))
);
