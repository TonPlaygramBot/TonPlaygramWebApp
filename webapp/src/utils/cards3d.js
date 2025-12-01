import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';
import { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

export { CARD_THEMES, DEFAULT_CARD_THEME } from './cardThemes.js';

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
  const { frontMaterial, backMaterial, hiddenMaterial, cardFace } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial || face === cardFace) return;
  if (face === 'back') {
    const mat = hiddenMaterial ?? backMaterial;
    mesh.material[4] = mat;
    mesh.material[5] = mat;
    mesh.userData.cardFace = 'back';
  } else {
    mesh.material[4] = frontMaterial;
    mesh.material[5] = frontMaterial;
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
  const label = String(rank);
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
  const [c1, c2] = theme.backGradient || [theme.backColor, theme.backColor];
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, c1 || '#0f172a');
  gradient.addColorStop(1, c2 || '#0b1220');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
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
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  return texture;
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
