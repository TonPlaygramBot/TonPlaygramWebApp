import { swatchThumbnail } from '../config/storeThumbnails.js';

export const CARD_THEMES = [
  {
    id: 'aurora',
    label: 'Aurora',
    frontBackground: '#ffffff',
    frontBorder: '#e2e8f0',
    edgeColor: '#f0f2f5',
    backColor: '#0f172a',
    backGradient: ['#1f2937', '#0b1220'],
    backAccent: 'rgba(148, 163, 184, 0.35)',
    backPattern: 'rings',
    hiddenColor: '#0b1020',
    thumbnail: swatchThumbnail(['#1f2937', '#0b1220', '#e2e8f0'])
  },
  {
    id: 'solstice',
    label: 'Solstice',
    frontBackground: '#fffaf0',
    frontBorder: '#facc15',
    edgeColor: '#fef3c7',
    backColor: '#78350f',
    backGradient: ['#b45309', '#7c2d12'],
    backAccent: 'rgba(255, 221, 148, 0.4)',
    backPattern: 'sunburst',
    hiddenColor: '#3d1a05',
    thumbnail: swatchThumbnail(['#b45309', '#7c2d12', '#fde68a'])
  },
  {
    id: 'nebula',
    label: 'Nebula',
    frontBackground: '#f8fafc',
    frontBorder: '#a855f7',
    edgeColor: '#e9d5ff',
    backColor: '#312e81',
    backGradient: ['#5b21b6', '#312e81'],
    backAccent: 'rgba(196, 181, 253, 0.4)',
    backPattern: 'stars',
    hiddenColor: '#1e1b4b',
    thumbnail: swatchThumbnail(['#5b21b6', '#312e81', '#e9d5ff'])
  },
  {
    id: 'jade',
    label: 'Jade',
    frontBackground: '#f0fdf4',
    frontBorder: '#22c55e',
    edgeColor: '#dcfce7',
    backColor: '#064e3b',
    backGradient: ['#047857', '#064e3b'],
    backAccent: 'rgba(74, 222, 128, 0.45)',
    backPattern: 'diamonds',
    hiddenColor: '#022c22',
    thumbnail: swatchThumbnail(['#047857', '#064e3b', '#bbf7d0'])
  },
  {
    id: 'ember',
    label: 'Ember',
    frontBackground: '#fff7ed',
    frontBorder: '#f97316',
    edgeColor: '#fed7aa',
    backColor: '#7c2d12',
    backGradient: ['#ea580c', '#7c2d12'],
    backAccent: 'rgba(251, 146, 60, 0.45)',
    backPattern: 'chevrons',
    hiddenColor: '#3b1306',
    thumbnail: swatchThumbnail(['#ea580c', '#7c2d12', '#fed7aa'])
  },
  {
    id: 'onyx',
    label: 'Onyx',
    frontBackground: '#f4f4f5',
    frontBorder: '#9ca3af',
    edgeColor: '#e4e4e7',
    backColor: '#1f2937',
    backGradient: ['#111827', '#1f2937'],
    backAccent: 'rgba(148, 163, 184, 0.5)',
    backPattern: 'grid',
    hiddenColor: '#0b0f17',
    thumbnail: swatchThumbnail(['#111827', '#1f2937', '#e5e7eb'])
  },
  {
    id: 'royal-sapphire',
    label: 'Royal Sapphire',
    frontBackground: '#f8fbff',
    frontBorder: '#2563eb',
    edgeColor: '#dbeafe',
    backColor: '#1d4ed8',
    backGradient: ['#2563eb', '#1e3a8a'],
    backAccent: 'rgba(191, 219, 254, 0.45)',
    backPattern: 'waves',
    hiddenColor: '#102356',
    thumbnail: swatchThumbnail(['#2563eb', '#1e3a8a', '#bfdbfe'])
  },
  {
    id: 'violet-crown',
    label: 'Violet Crown',
    frontBackground: '#faf5ff',
    frontBorder: '#9333ea',
    edgeColor: '#f3e8ff',
    backColor: '#6d28d9',
    backGradient: ['#7e22ce', '#4c1d95'],
    backAccent: 'rgba(216, 180, 254, 0.4)',
    backPattern: 'crosshatch',
    hiddenColor: '#2f1365',
    thumbnail: swatchThumbnail(['#7e22ce', '#4c1d95', '#d8b4fe'])
  },
  {
    id: 'crimson-royale',
    label: 'Crimson Royale',
    frontBackground: '#fff1f2',
    frontBorder: '#dc2626',
    edgeColor: '#fecdd3',
    backColor: '#b91c1c',
    backGradient: ['#ef4444', '#7f1d1d'],
    backAccent: 'rgba(254, 202, 202, 0.45)',
    backPattern: 'lattice',
    hiddenColor: '#450a0a',
    thumbnail: swatchThumbnail(['#ef4444', '#7f1d1d', '#fecaca'])
  },
  {
    id: 'mint-circuit',
    label: 'Mint Circuit',
    frontBackground: '#ecfeff',
    frontBorder: '#14b8a6',
    edgeColor: '#ccfbf1',
    backColor: '#0f766e',
    backGradient: ['#0d9488', '#134e4a'],
    backAccent: 'rgba(153, 246, 228, 0.45)',
    backPattern: 'circuit',
    hiddenColor: '#042f2e',
    thumbnail: swatchThumbnail(['#0d9488', '#134e4a', '#99f6e4'])
  }
];

export const DEFAULT_CARD_THEME = CARD_THEMES[0];
