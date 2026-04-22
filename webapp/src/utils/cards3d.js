import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applySRGBColorSpace } from './colorSpace.js';
import { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

export { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

const TONPLAYGRAM_LOGO_SRC = '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp';
let tonplaygramLogoImage = null;
const cardBackTextureCache = new Map();

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
  ctx.fillStyle = theme.frontBackground || '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.frontBorder || '#e5e7eb';
  ctx.lineWidth = 8;
  roundRect(ctx, 6, 6, w - 12, h - 12, 32);
  ctx.stroke();
  const suitColor = getSuitColor(suit);
  ctx.fillStyle = suitColor;
  const label = rank === 'T' ? '10' : String(rank);
  const padding = 34;
  const rankFontSize = 88;
  const suitFontSize = 72;
  const cornerGap = 66;
  const drawCorner = (x, y, align = 'left', flipped = false) => {
    ctx.save();
    ctx.translate(x, y);
    if (flipped) {
      ctx.rotate(Math.PI);
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.font = `bold ${rankFontSize}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`;
    ctx.fillText(label, 0, 0);
    ctx.font = `bold ${suitFontSize}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`;
    ctx.fillText(convertSuit(suit), 0, cornerGap);
    ctx.restore();
  };
  drawCorner(padding, 48, 'left');
  drawCorner(w - padding, h - 48, 'left', true);
  if (theme.centerAccent) {
    ctx.fillStyle = theme.centerAccent;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCenterGlyphs(ctx, {
    rank: label,
    suit,
    suitColor,
    w,
    h
  });
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  return texture;
}

function drawCenterGlyphs(ctx, { rank, suit, suitColor, w, h }) {
  const faceRanks = new Set(['J', 'Q', 'K']);
  if (faceRanks.has(rank)) {
    drawFaceCardIllustration(ctx, { rank, suit, suitColor, w, h });
    return;
  }
  const pipCount = rank === 'A' ? 1 : Number.parseInt(rank, 10);
  if (!Number.isFinite(pipCount) || pipCount <= 0) {
    drawSingleSuitGlyph(ctx, suit, suitColor, w, h, 160);
    return;
  }
  drawPipLayout(ctx, pipCount, suit, suitColor, w, h);
}

function drawSingleSuitGlyph(ctx, suit, suitColor, w, h, size = 150) {
  ctx.fillStyle = suitColor;
  ctx.font = `bold ${size}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(convertSuit(suit), w / 2, h / 2);
}

function drawPipLayout(ctx, pipCount, suit, suitColor, w, h) {
  const layouts = {
    1: [[0, 0]],
    2: [[0, -0.34], [0, 0.34]],
    3: [[0, -0.36], [0, 0], [0, 0.36]],
    4: [[-0.22, -0.34], [0.22, -0.34], [-0.22, 0.34], [0.22, 0.34]],
    5: [[-0.22, -0.34], [0.22, -0.34], [0, 0], [-0.22, 0.34], [0.22, 0.34]],
    6: [[-0.24, -0.36], [0.24, -0.36], [-0.24, 0], [0.24, 0], [-0.24, 0.36], [0.24, 0.36]],
    7: [[-0.24, -0.36], [0.24, -0.36], [-0.24, -0.06], [0.24, -0.06], [0, 0.16], [-0.24, 0.36], [0.24, 0.36]],
    8: [[-0.24, -0.38], [0.24, -0.38], [-0.24, -0.12], [0.24, -0.12], [-0.24, 0.12], [0.24, 0.12], [-0.24, 0.38], [0.24, 0.38]],
    9: [[-0.24, -0.38], [0.24, -0.38], [-0.24, -0.14], [0.24, -0.14], [0, 0], [-0.24, 0.14], [0.24, 0.14], [-0.24, 0.38], [0.24, 0.38]],
    10: [[-0.24, -0.4], [0.24, -0.4], [-0.24, -0.18], [0.24, -0.18], [-0.24, 0.04], [0.24, 0.04], [-0.24, 0.26], [0.24, 0.26], [-0.24, 0.44], [0.24, 0.44]]
  };
  const points = layouts[pipCount] ?? layouts[1];
  const fontSize = pipCount >= 9 ? 78 : pipCount >= 6 ? 88 : 98;
  ctx.fillStyle = suitColor;
  ctx.font = `bold ${fontSize}px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [dx, dy] of points) {
    ctx.fillText(convertSuit(suit), w / 2 + dx * w, h / 2 + dy * h);
  }
}

function drawFaceCardIllustration(ctx, { rank, suit, suitColor, w, h }) {
  const centerX = w / 2;
  const centerY = h / 2;
  const frameW = w * 0.58;
  const frameH = h * 0.5;
  const frameX = centerX - frameW / 2;
  const frameY = centerY - frameH / 2;
  const bodyColor = suitColor === '#cc2233' ? '#f5d0d0' : '#d9dde7';
  const accent = suitColor === '#cc2233' ? '#b91c1c' : '#1f2937';

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  roundRect(ctx, frameX + 5, frameY + 8, frameW, frameH, 36);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 5;
  roundRect(ctx, frameX, frameY, frameW, frameH, 36);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = '#f6d4b8';
  ctx.beginPath();
  ctx.arc(centerX, centerY - frameH * 0.22, frameW * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // Crown/hat
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(centerX - frameW * 0.16, centerY - frameH * 0.33);
  ctx.lineTo(centerX - frameW * 0.08, centerY - frameH * 0.44);
  ctx.lineTo(centerX, centerY - frameH * 0.35);
  ctx.lineTo(centerX + frameW * 0.08, centerY - frameH * 0.44);
  ctx.lineTo(centerX + frameW * 0.16, centerY - frameH * 0.33);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = bodyColor;
  roundRect(ctx, centerX - frameW * 0.18, centerY - frameH * 0.09, frameW * 0.36, frameH * 0.36, 30);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Scepter / sword cue for face cards
  ctx.strokeStyle = accent;
  ctx.lineWidth = rank === 'J' ? 6 : 5;
  ctx.beginPath();
  if (rank === 'J') {
    ctx.moveTo(centerX - frameW * 0.2, centerY + frameH * 0.2);
    ctx.lineTo(centerX + frameW * 0.2, centerY - frameH * 0.02);
  } else if (rank === 'Q') {
    ctx.moveTo(centerX, centerY + frameH * 0.22);
    ctx.lineTo(centerX, centerY - frameH * 0.04);
  } else {
    ctx.moveTo(centerX + frameW * 0.18, centerY + frameH * 0.2);
    ctx.lineTo(centerX - frameW * 0.18, centerY - frameH * 0.02);
  }
  ctx.stroke();

  drawSingleSuitGlyph(ctx, suit, suitColor, w, h, 86);
  ctx.fillStyle = accent;
  ctx.font = 'bold 72px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rank, centerX, frameY + frameH - 42);
  ctx.restore();
}

export function makeTonplaygramCardBackTexture(theme, w = 3072, h = 4320) {
  const safeWidth = Math.max(512, Math.round(Math.min(w, 1024)));
  const safeHeight = Math.max(768, Math.round(Math.min(h, 1536)));
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
    const logoBoxWidth = w * 0.94;
    const logoBoxHeight = h * 0.4;
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

function getSuitColor(suit) {
  if (suit === 'H' || suit === 'D') return '#cc2233';
  return '#111111';
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
