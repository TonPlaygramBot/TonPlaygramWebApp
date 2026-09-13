import { GEM_COLORS, DISTRICT_COLORS } from './shared/catalog.mjs';
import * as THREE from 'three';
import type { GameView } from './types';
import { CITY_NAMES, TILE_COLORS, PLAYER_COLORS } from './shared/catalog.mjs';
export const perimeter = (i: number): [number, number] =>
  i < 7 ? [i, 6] : i < 13 ? [6, 12 - i] : i < 19 ? [18 - i, 0] : [0, i - 18];
export function boardTexture(s: GameView, viewer: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1400;
  const x = c.getContext('2d')!;
  x.fillStyle = '#102f36';
  x.fillRect(0, 0, 1400, 1400);
  const text = (
    str: string,
    cx: number,
    cy: number,
    size = 32,
    color = '#edeee6'
  ) => {
    x.fillStyle = color;
    x.font = `600 ${size}px system-ui`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(str, cx, cy);
  };
  const box = (
    left: number,
    top: number,
    w: number,
    h: number,
    color: string
  ) => {
    x.fillStyle = color;
    x.fillRect(left, top, w, h);
    x.strokeStyle = '#71969866';
    x.lineWidth = 3;
    x.strokeRect(left, top, w, h);
  };
  if (s.gameId === 'oligarchs') {
    s.board!.forEach((cell, i) => {
      const [cx, cy] = perimeter(i),
        left = cx * 200,
        top = cy * 200;
      box(
        left + 4,
        top + 4,
        192,
        192,
        cell.kind === 'property' ? '#ecede2' : '#d9dfce'
      );
      box(
        left + 4,
        top + 4,
        192,
        32,
        cell.owner >= 0
          ? PLAYER_COLORS[cell.owner]
          : DISTRICT_COLORS[cell.district || 0]
      );
      const words = cell.name.split(' ');
      words.forEach((word, j) =>
        text(word, left + 100, top + 76 + j * 32, 26, '#183e41')
      );
      text(
        cell.kind === 'property'
          ? `${cell.price} ¤`
          : cell.kind === 'tax'
            ? '−60'
            : cell.kind === 'grant'
              ? '+80'
              : cell.kind === 'start'
                ? '+120'
                : '?',
        left + 100,
        top + 159,
        28,
        '#254b4c'
      );
    });
    text('OLIGARCHS', 700, 560, 75, '#eed19a');
    text('PROPERTY · POWER · PRESTIGE', 700, 650, 23, '#b5c7b9');
    text(`ROUND ${Math.min(16, s.round)} / 16`, 700, 750, 34, '#eed19a');
    if (s.dice) text(s.dice.join('  +  '), 700, 870, 75);
    text('TONPLAYGRAM', 700, 1030, 22, '#9db6ab');
  } else if (s.gameId === 'harborempires') {
    s.board!.forEach((cell, i) => {
      const left = 70 + (i % 4) * 315,
        top = 70 + Math.floor(i / 4) * 315;
      box(
        left,
        top,
        295,
        295,
        ['#37664f', '#8e5147', '#8d7847'][cell.resource!]
      );
      text(String(i + 1), left + 147, top + 58, 35);
      text(
        ['TIMBER', 'BRICK', 'GRAIN'][cell.resource!],
        left + 147,
        top + 240,
        27
      );
      text(`⚄ ${cell.number}`, left + 147, top + 186, 31);
    });
  } else if (s.gameId === 'railkingdoms') {
    s.routes!.forEach((r, i) => {
      const a = [170 + (r.a % 4) * 350, 180 + Math.floor(r.a / 4) * 500],
        b = [170 + (r.b % 4) * 350, 180 + Math.floor(r.b / 4) * 500];
      x.strokeStyle =
        r.owner >= 0 ? PLAYER_COLORS[r.owner] : GEM_COLORS[r.color];
      x.lineWidth = r.owner >= 0 ? 24 : 16;
      x.setLineDash(r.owner >= 0 ? [] : [20, 14]);
      x.beginPath();
      x.moveTo(...(a as [number, number]));
      x.lineTo(...(b as [number, number]));
      x.stroke();
      x.setLineDash([]);
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      box(mx - 32, my - 25, 64, 50, '#102f36');
      text(String(r.length), mx, my, 31);
    });
    CITY_NAMES.forEach((name: string, i: number) => {
      const cx = 170 + (i % 4) * 350,
        cy = 180 + Math.floor(i / 4) * 500;
      x.fillStyle = '#ead6a9';
      x.beginPath();
      x.arc(cx, cy, 34, 0, Math.PI * 2);
      x.fill();
      text(name, cx, cy + 65, 31);
    });
  } else if (s.gameId === 'mosaicroyal') {
    text('MOSAIC ROYAL', 700, 85, 53, '#c2d8f1');
    text('YOUR WALL', 700, 700, 30);
    const p = s.players[viewer] || s.players[0];
    p.wall.forEach((row, r) =>
      row.forEach((filled, col) =>
        box(
          390 + col * 125,
          770 + r * 112,
          102,
          95,
          filled ? TILE_COLORS[(col - r + 5) % 5] : '#294852'
        )
      )
    );
    text('DRAFT TILES · COMPLETE ROWS', 700, 1340, 26);
  } else {
    text('GEM SYNDICATE', 700, 90, 58, '#d7a4f2');
    s.market?.forEach((card, i) => {
      const left = 85 + (i % 3) * 430,
        top = 230 + Math.floor(i / 3) * 530;
      box(left, top, 370, 460, '#ede4cf');
      box(left, top, 370, 40, GEM_COLORS[card.color]);
      text(card.name, left + 185, top + 95, 35, '#283943');
      text(`${card.points} PRESTIGE`, left + 185, top + 160, 26, '#283943');
      text('COST', left + 185, top + 325, 23, '#4c5a60');
      card.cost.forEach((n, j) => {
        x.fillStyle = GEM_COLORS[j];
        x.beginPath();
        x.arc(left + 85 + j * 100, top + 380, 28, 0, Math.PI * 2);
        x.fill();
        text(String(n), left + 85 + j * 100, top + 380, 28, '#102630');
      });
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
