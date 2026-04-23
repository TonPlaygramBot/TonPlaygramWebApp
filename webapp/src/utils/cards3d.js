import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as OpenSourceDeck from '@letele/playing-cards';
import { applySRGBColorSpace } from './colorSpace.js';
import { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

export { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

const TONPLAYGRAM_LOGO_SRC = '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp';
let tonplaygramLogoImage = null;
const cardBackTextureCache = new Map();


const OPEN_SOURCE_CARD_MODULE = OpenSourceDeck;
const openSourceSvgCache = new Map();

function normalizeRankForOpenSource(rank) {
  const normalized = String(rank || '').trim().toLowerCase();
  if (normalized === '1') return 'a';
  if (normalized === 't') return '10';
  if (normalized === '11') return 'j';
  if (normalized === '12') return 'q';
  if (normalized === '13') return 'k';
  return normalized;
}

function normalizeSuitForOpenSource(suit) {
  const normalized = String(suit || '').trim().toUpperCase();
  if (normalized === '♠') return 'S';
  if (normalized === '♥') return 'H';
  if (normalized === '♦') return 'D';
  if (normalized === '♣') return 'C';
  return normalized;
}

function resolveOpenSourceDeckKey(rank, suit) {
  const normalizedRank = normalizeRankForOpenSource(rank);
  const normalizedSuit = normalizeSuitForOpenSource(suit);
  if (!normalizedRank || !normalizedSuit) return null;
  const key = `${normalizedSuit}${normalizedRank}`;
  return OPEN_SOURCE_CARD_MODULE[key] ? key : null;
}

function createFallbackOpenSourceSvg(rank, suit) {
  const rankLabel = rank === 'T' ? '10' : String(rank || '?').toUpperCase();
  const suitLabel = convertSuit(String(suit || '?').toUpperCase());
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400">
      <rect x="18" y="18" rx="42" ry="42" width="964" height="1364" fill="#ffffff" stroke="rgba(0,0,0,0.12)" stroke-width="8" />
      <text x="500" y="680" text-anchor="middle" font-size="210" font-family="Georgia, serif" fill="#111111">${rankLabel}${suitLabel}</text>
    </svg>
  `;
}

function cardSvgMarkup(rank, suit) {
  const key = resolveOpenSourceDeckKey(rank, suit);
  if (!key) return createFallbackOpenSourceSvg(rank, suit);
  if (openSourceSvgCache.has(key)) return openSourceSvgCache.get(key);
  const CardComponent = OPEN_SOURCE_CARD_MODULE[key];
  const svg = renderToStaticMarkup(React.createElement(CardComponent, { width: 1000, height: 1400 }));
  openSourceSvgCache.set(key, svg);
  return svg;
}

function drawOpenSourceCardFront(ctx, canvas, rank, suit, onLoad = null) {
  if (typeof Image === 'undefined') return;
  const svg = cardSvgMarkup(rank, suit);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (typeof onLoad === 'function') onLoad();
  };
  image.src = dataUrl;
}

function getTonplaygramLogoImage() {
  if (!tonplaygramLogoImage && typeof Image !== 'undefined') {
    tonplaygramLogoImage = new Image();
    tonplaygramLogoImage.crossOrigin = 'anonymous';
    tonplaygramLogoImage.src = TONPLAYGRAM_LOGO_SRC;
  }
  return tonplaygramLogoImage;
}

export function createCardGeometry(width, height, depth, options = {}) {
  const {
    rounded = true,
    cornerRadiusRatio = 0.08,
    segments = 5
  } = options;
  if (!rounded) {
    return new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
  }
  const safeRadius = Math.max(
    0.001,
    Math.min(
      Math.min(width, height) * cornerRadiusRatio,
      Math.min(depth * 0.45, Math.min(width, height) * 0.12)
    )
  );
  return new RoundedBoxGeometry(width, height, depth, segments, safeRadius);
}

export function createCardMesh(card, geometry, cache, theme = DEFAULT_CARD_THEME) {
  const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
  let faceTexture = cache?.get?.(faceKey);
  if (!faceTexture) {
    faceTexture = makeCardFace(card.rank, card.suit, theme);
    cache?.set?.(faceKey, faceTexture);
  }
  const backTexture = makeTonplaygramCardBackTexture(theme);
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.edgeColor || '#f0f2f5'),
    roughness: 0.55,
    metalness: 0.1
  });
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.08,
    color: new THREE.Color('#ffffff')
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    // Keep the texture colors true-to-source (logo + pattern) instead of tinting.
    color: new THREE.Color('#ffffff'),
    roughness: 0.6,
    metalness: 0.15,
    emissive: new THREE.Color('#0f172a'),
    emissiveIntensity: 0.08
  });
  const hiddenMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.hiddenColor || theme.backColor || '#0f172a'),
    roughness: 0.7,
    metalness: 0.12
  });
  const materials = [edgeMaterial, edgeMaterial.clone(), edgeMaterial.clone(), edgeMaterial.clone(), frontMaterial, backMaterial];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.card = card;
  mesh.userData.frontMaterial = frontMaterial;
  mesh.userData.backMaterial = backMaterial;
  mesh.userData.hiddenMaterial = hiddenMaterial;
  mesh.userData.edgeMaterials = materials.slice(0, 4);
  mesh.userData.backTexture = backTexture;
  mesh.userData.cardFace = 'front';
  return mesh;
}

export function orientCard(mesh, lookTarget, { face = 'front', flat = true } = {}) {
  if (!mesh) return;
  mesh.up.set(0, 1, 0);
  mesh.lookAt(lookTarget);
  mesh.rotation.z = 0;
  if (flat) {
    mesh.rotateX(-Math.PI / 2);
  }
  if (face === 'back') {
    mesh.rotateY(Math.PI);
  }
}

export function setCardFace(mesh, face) {
  if (!mesh?.material) return;
  const { frontMaterial, backMaterial } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial) return;
  if (face === 'back') {
    mesh.material[4] = backMaterial;
    mesh.material[5] = backMaterial;
    mesh.userData.cardFace = 'back';
  } else {
    mesh.material[4] = frontMaterial;
    mesh.material[5] = backMaterial;
    mesh.userData.cardFace = 'front';
  }
}

function makeCardFace(rank, suit, theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    applySRGBColorSpace(texture);
    return texture;
  }

  ctx.fillStyle = theme.frontBackground || '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  texture.needsUpdate = true;
  drawOpenSourceCardFront(ctx, canvas, rank, suit, () => {
    texture.needsUpdate = true;
  });

  return texture;
}

export function makeTonplaygramCardBackTexture(theme, w = 3072, h = 4320) {
  const safeWidth = Math.max(1024, Math.round(Math.min(w, 3072)));
  const safeHeight = Math.max(1440, Math.round(Math.min(h, 4320)));
  const cacheKey = `${theme?.id || 'default'}:${safeWidth}x${safeHeight}`;
  const cachedTexture = cardBackTextureCache.get(cacheKey);
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const ctx = canvas.getContext('2d');
  const drawBack = () => {
    const cardBackPattern = ctx.createPattern(makeLuckyCardBackPatternCanvas(), 'repeat');
    ctx.fillStyle = cardBackPattern || '#112233';
    ctx.fillRect(0, 0, safeWidth, safeHeight);

    drawLogoFrame(ctx, safeWidth, safeHeight, theme);
  };

  drawBack();

  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 16;
  texture.flipY = false;

  const logoImage = getTonplaygramLogoImage();
  if (logoImage && !(logoImage.complete && logoImage.naturalWidth > 0)) {
    logoImage.addEventListener(
      'load',
      () => {
        drawBack();
        texture.needsUpdate = true;
      },
      { once: true }
    );
  }

  cardBackTextureCache.set(cacheKey, texture);
  return texture;
}

function makeLuckyCardBackPatternCanvas(size = 96) {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;
  const patternCtx = patternCanvas.getContext('2d');
  patternCtx.fillStyle = '#223333';
  patternCtx.fillRect(0, 0, size, size);
  patternCtx.fillStyle = '#112222';
  patternCtx.beginPath();
  patternCtx.moveTo(0, size * 0.5);
  patternCtx.lineTo(size * 0.5, 0);
  patternCtx.lineTo(size, size * 0.5);
  patternCtx.lineTo(size * 0.5, size);
  patternCtx.closePath();
  patternCtx.fill();
  return patternCanvas;
}

function drawBackPattern(ctx, w, h, theme) {
  const accent = theme.backAccent || 'rgba(255,255,255,0.2)';
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.32;

  switch (theme.backPattern) {
    case 'sunburst': {
      ctx.lineWidth = 2;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 20) {
        const x = w / 2 + Math.cos(angle) * w * 0.5;
        const y = h / 2 + Math.sin(angle) * h * 0.5;
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      break;
    }
    case 'stars': {
      for (let i = 0; i < 60; i += 1) {
        const x = (i * 97) % w;
        const y = (i * 151) % h;
        const size = (i % 4) + 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'diamonds': {
      ctx.lineWidth = 2.5;
      const step = 50;
      for (let y = -step; y < h + step; y += step) {
        for (let x = -step; x < w + step; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, y + step / 2);
          ctx.lineTo(x + step / 2, y);
          ctx.lineTo(x + step, y + step / 2);
          ctx.lineTo(x + step / 2, y + step);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    case 'chevrons': {
      ctx.lineWidth = 3;
      for (let y = -20; y < h + 40; y += 34) {
        ctx.beginPath();
        for (let x = -40; x < w + 40; x += 34) {
          ctx.lineTo(x + 17, y);
          ctx.lineTo(x + 34, y + 14);
        }
        ctx.stroke();
      }
      break;
    }
    case 'grid': {
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }
    case 'waves': {
      ctx.lineWidth = 3;
      for (let y = 20; y < h; y += 36) {
        ctx.beginPath();
        for (let x = -40; x <= w + 40; x += 20) {
          const waveY = y + Math.sin(x * 0.05) * 8;
          if (x === -40) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
      break;
    }
    case 'crosshatch': {
      ctx.lineWidth = 2;
      for (let x = -h; x < w + h; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + h, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      break;
    }
    case 'lattice': {
      ctx.lineWidth = 2.4;
      const step = 42;
      for (let y = 0; y < h + step; y += step) {
        for (let x = 0; x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;
    }
    case 'circuit': {
      ctx.lineWidth = 2.2;
      for (let y = 18; y < h; y += 42) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        for (let x = 48; x < w - 18; x += 44) {
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + (x % 88 === 0 ? 14 : -14));
        }
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i += 1) {
        const inset = 24 + i * 18;
        roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 26);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

function drawLogoFrame(ctx, w, h, theme) {
  const frameInset = Math.min(w, h) * 0.045;
  const frameRadius = Math.min(w, h) * 0.04;
  const frameWidth = w - frameInset * 2;
  const frameHeight = h - frameInset * 2;
  const logoImage = getTonplaygramLogoImage();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.56)';
  ctx.lineWidth = Math.max(12, Math.round(w * 0.007));
  roundRect(ctx, frameInset, frameInset, frameWidth, frameHeight, frameRadius);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(5, Math.round(w * 0.003));
  roundRect(ctx, frameInset + 24, frameInset + 24, frameWidth - 48, frameHeight - 48, frameRadius * 0.85);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const plateWidth = w * 0.92;
  const plateHeight = h * 0.38;
  const plateX = (w - plateWidth) / 2;
  const plateY = (h - plateHeight) / 2;
  const plateGradient = ctx.createLinearGradient(plateX, plateY, plateX, plateY + plateHeight);
  plateGradient.addColorStop(0, 'rgba(8, 15, 35, 0.82)');
  plateGradient.addColorStop(1, 'rgba(15, 23, 42, 0.7)');
  ctx.fillStyle = plateGradient;
  roundRect(ctx, plateX, plateY, plateWidth, plateHeight, Math.min(w, h) * 0.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.36)';
  ctx.lineWidth = Math.max(4, Math.round(w * 0.0028));
  roundRect(ctx, plateX + 8, plateY + 8, plateWidth - 16, plateHeight - 16, Math.min(w, h) * 0.032);
  ctx.stroke();

  if (logoImage?.complete && logoImage.naturalWidth > 0) {
    const ratio = logoImage.naturalWidth / Math.max(logoImage.naturalHeight, 1);
    const logoBoxWidth = w * 1.96;
    const logoBoxHeight = h * 0.92;
    const drawWidth = Math.min(logoBoxWidth, logoBoxHeight * ratio);
    const drawHeight = drawWidth / ratio;
    const logoX = w / 2 - drawWidth / 2;
    const logoY = h / 2 - drawHeight / 2;
    ctx.drawImage(logoImage, logoX, logoY, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = theme.backAccent || 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 48px "Inter", system-ui, sans-serif';
    ctx.fillText('TonPlaygram', w / 2, h / 2);
  }

  ctx.restore();
}

function convertSuit(suit) {
  switch (suit) {
    case 'H':
      return '♥';
    case 'D':
      return '♦';
    case 'C':
      return '♣';
    case 'S':
      return '♠';
    default:
      return suit;
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
