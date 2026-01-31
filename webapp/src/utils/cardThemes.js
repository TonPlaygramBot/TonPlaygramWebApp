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
    hiddenColor: '#0b1020',
    thumbnail: swatchThumbnail(['#1f2937', '#0b1220', '#e2e8f0'])
  },
  {
    id: 'solstice',
    label: 'Solstic',
    frontBackground: '#fffaf0',
    frontBorder: '#facc15',
    edgeColor: '#fef3c7',
    backColor: '#78350f',
    backGradient: ['#b45309', '#7c2d12'],
    backAccent: 'rgba(255, 221, 148, 0.4)',
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
    hiddenColor: '#1e1b4b',
    thumbnail: swatchThumbnail(['#5b21b6', '#312e81', '#e9d5ff'])
  },
  {
    id: 'jade',
    label: 'Xhade',
    frontBackground: '#f0fdf4',
    frontBorder: '#22c55e',
    edgeColor: '#dcfce7',
    backColor: '#064e3b',
    backGradient: ['#047857', '#064e3b'],
    backAccent: 'rgba(74, 222, 128, 0.45)',
    hiddenColor: '#022c22',
    thumbnail: swatchThumbnail(['#047857', '#064e3b', '#bbf7d0'])
  },
  {
    id: 'ember',
    label: 'Gaca',
    frontBackground: '#fff7ed',
    frontBorder: '#f97316',
    edgeColor: '#fed7aa',
    backColor: '#7c2d12',
    backGradient: ['#ea580c', '#7c2d12'],
    backAccent: 'rgba(251, 146, 60, 0.45)',
    hiddenColor: '#3b1306',
    thumbnail: swatchThumbnail(['#ea580c', '#7c2d12', '#fed7aa'])
  },
  {
    id: 'onyx',
    label: 'Oniks',
    frontBackground: '#f4f4f5',
    frontBorder: '#9ca3af',
    edgeColor: '#e4e4e7',
    backColor: '#1f2937',
    backGradient: ['#111827', '#1f2937'],
    backAccent: 'rgba(148, 163, 184, 0.5)',
    hiddenColor: '#0b0f17',
    thumbnail: swatchThumbnail(['#111827', '#1f2937', '#e5e7eb'])
  }
];

export const DEFAULT_CARD_THEME = CARD_THEMES[0];
