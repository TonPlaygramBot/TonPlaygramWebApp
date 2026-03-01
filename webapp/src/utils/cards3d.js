import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';
import { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

export { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

const TONPLAYGRAM_LOGO_SRC = '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp';
let tonplaygramLogoImage = null;

function getTonplaygramLogoImage() {
  if (!tonplaygramLogoImage && typeof Image !== 'undefined') {
    tonplaygramLogoImage = new Image();
    tonplaygramLogoImage.crossOrigin = 'anonymous';
    tonplaygramLogoImage.src = TONPLAYGRAM_LOGO_SRC;
  }
  return tonplaygramLogoImage;
}

export function createCardGeometry(width, height, depth) {
  return new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
}

export function createCardMesh(card, geometry, cache, theme = DEFAULT_CARD_THEME) {
  const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
  let faceTexture = cache?.get?.(faceKey);
  if (!faceTexture) {
    faceTexture = makeCardFace(card.rank, card.suit, theme);
    cache?.set?.(faceKey, faceTexture);
  }
  const backTexture = makeCardBackTexture(theme);
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
    color: new THREE.Color(theme.backColor || '#0f172a'),
    roughness: 0.6,
    metalness: 0.15
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
  const { frontMaterial, backMaterial, hiddenMaterial } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial) return;
  if (face === 'back') {
    const mat = hiddenMaterial ?? backMaterial;
    mesh.material[4] = mat;
    mesh.material[5] = mat;
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
  const label = rank === 'T' ? 'Q' : String(rank);
  const padding = 36;
  const topRankY = 96;
  const topSuitY = topRankY + 76;
  const bottomSuitY = h - 92;
  const bottomRankY = bottomSuitY - 76;
  ctx.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.fillText(label, padding, topRankY);
  ctx.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(convertSuit(suit), padding, topSuitY);
  ctx.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(label, padding, bottomRankY);
  ctx.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(convertSuit(suit), padding, bottomSuitY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(label, w - padding, topRankY);
  ctx.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(convertSuit(suit), w - padding, topSuitY);
  ctx.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(label, w - padding, bottomRankY);
  ctx.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.fillText(convertSuit(suit), w - padding, bottomSuitY);
  if (theme.centerAccent) {
    ctx.fillStyle = theme.centerAccent;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = suitColor;
  ctx.font = 'bold 160px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.fillText(convertSuit(suit), w / 2, h / 2 + 56);
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  return texture;
}

function makeCardBackTexture(theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const drawBack = () => {
    const [c1, c2] = theme.backGradient || [theme.backColor, theme.backColor];
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, c1 || '#0f172a');
    gradient.addColorStop(1, c2 || '#0b1220');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    drawBackPattern(ctx, w, h, theme);

    ctx.strokeStyle = theme.backBorder || 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 14;
    roundRect(ctx, 18, 18, w - 36, h - 36, 48);
    ctx.stroke();
    if (theme.backAccent) {
      ctx.strokeStyle = theme.backAccent;
      ctx.lineWidth = 8;
      for (let i = 0; i < 6; i += 1) {
        const inset = 36 + i * 18;
        roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 42);
        ctx.stroke();
      }
    }

    drawLogoFrame(ctx, w, h, theme);
  };

  drawBack();

  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;

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

  return texture;
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
  const frameWidth = w * 0.68;
  const frameHeight = h * 0.22;
  const frameX = (w - frameWidth) / 2;
  const frameY = (h - frameHeight) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
  roundRect(ctx, frameX - 4, frameY - 4, frameWidth + 8, frameHeight + 8, 24);
  ctx.fill();

  ctx.strokeStyle = theme.backAccent || 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, frameX, frameY, frameWidth, frameHeight, 20);
  ctx.stroke();

  const logoImage = getTonplaygramLogoImage();
  if (logoImage?.complete && logoImage.naturalWidth > 0) {
    const ratio = logoImage.naturalWidth / Math.max(logoImage.naturalHeight, 1);
    const drawWidth = Math.min(frameWidth * 0.82, frameHeight * ratio);
    const drawHeight = drawWidth / ratio;
    const logoX = w / 2 - drawWidth / 2;
    const logoY = h / 2 - drawHeight / 2;
    ctx.drawImage(logoImage, logoX, logoY, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px "Inter", system-ui, sans-serif';
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
