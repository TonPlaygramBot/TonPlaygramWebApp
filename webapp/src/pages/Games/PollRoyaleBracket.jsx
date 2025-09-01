import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyaleBracket() {
  useTelegramBackButton();
  const canvasRef = useRef(null);
  const { search } = useLocation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const params = new URLSearchParams(search);
    const playerCount = parseInt(params.get('players')) || 8;
    const amount = parseInt(params.get('amount')) || 0;
    const name = params.get('name') || 'You';
    const avatar = params.get('avatar') || '';

    const players = [{ name, avatar }];
    for (let i = 1; i < playerCount; i++) {
      players.push({ name: `CPU ${i}`, avatar: '' });
    }
    const pot = amount * playerCount;

    const theme = {
      bg: '#0b1220',
      ink: '#e6edf7',
      muted: '#7a8aa1',
      accent: '#5da8ff',
      line: '#2a3550'
    };

    const tpcImg = new Image();
    tpcImg.src = '/assets/icons/ezgif-54c96d8a9b9236.webp';
    tpcImg.onload = () => render();

    function fitDPI() {
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (
        canvas.width !== Math.floor(cssW * dpr) ||
        canvas.height !== Math.floor(cssH * dpr)
      ) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function nodeText(str) {
      const trimmed = (str || '').toString();
      const max = 16;
      return trimmed.length > max
        ? trimmed.slice(0, max - 1) + '…'
        : trimmed.padEnd(Math.min(max, 16), ' ');
    }

    function drawAvatar(x, y, size, label) {
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.arc(x + size / 2, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((label || '?').charAt(0).toUpperCase(), x + size / 2, y);
    }

    function drawBox(x, y, w, h, player, alignLeft = true) {
      ctx.strokeStyle = '#3a4a74';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.rect(Math.round(x) + 0.5, Math.round(y - h / 2) + 0.5, w, h);
      ctx.stroke();
      if (player) {
        const size = 18;
        const ax = alignLeft ? x + 8 : x + w - 8 - size;
        drawAvatar(ax, y, size, player.name);
        const tx = alignLeft ? ax + size + 4 : ax - 4;
        ctx.fillStyle = theme.ink;
        ctx.font =
          '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.textAlign = alignLeft ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(nodeText(player.name), tx, y);
      }
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1.5;
    }

    function connectorLeft(x1, y1, x2, y2, parentX, parentY) {
      const sx1 = x1 + 160;
      const sx2 = x2 + 160;
      const midX = (sx1 + parentX) / 2;
      ctx.beginPath();
      ctx.moveTo(sx1, y1);
      ctx.lineTo(midX, y1);
      ctx.moveTo(sx2, y2);
      ctx.lineTo(midX, y2);
      ctx.moveTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.moveTo(midX, parentY);
      ctx.lineTo(parentX, parentY);
      ctx.stroke();
    }

    function connectorRight(x1, y1, x2, y2, parentX, parentY) {
      const sx1 = x1;
      const sx2 = x2;
      const midX = (sx1 + parentX) / 2;
      ctx.beginPath();
      ctx.moveTo(sx1, y1);
      ctx.lineTo(midX, y1);
      ctx.moveTo(sx2, y2);
      ctx.lineTo(midX, y2);
      ctx.moveTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.moveTo(midX, parentY);
      ctx.lineTo(parentX, parentY);
      ctx.stroke();
    }

    function drawFinalConnectors(
      leftFinalX,
      leftFinalY,
      rightFinalX,
      rightFinalY,
      centerX
    ) {
      const gap = 20;
      const leftEndX = centerX - 40 - gap;
      const rightEndX = centerX + 40 + gap;
      ctx.beginPath();
      ctx.moveTo(leftFinalX + 160, leftFinalY);
      ctx.lineTo(leftEndX, leftFinalY);
      ctx.moveTo(rightFinalX, rightFinalY);
      ctx.lineTo(rightEndX, rightFinalY);
      ctx.stroke();
    }

    function buildSide(side, leafCount, names) {
      const rounds = Math.log2(leafCount);
      const boxW = 160,
        boxH = 26,
        roundGap = 110,
        leafGap = 52,
        marginSide = 24;
      const xPositions = [];
      const centerX = canvas.clientWidth / 2;
      const centerY = canvas.clientHeight / 2;
      if (side === 'left') {
        const lastX = centerX - 80 - boxW;
        for (let r = rounds - 1; r >= 0; r--) {
          xPositions[r] = lastX - (rounds - 1 - r) * roundGap;
        }
      } else {
        const firstX = centerX + 80;
        for (let r = rounds - 1; r >= 0; r--) {
          xPositions[r] = firstX + (rounds - 1 - r) * roundGap;
        }
      }
      const leaves = [];
      const totalSpan = (leafCount - 1) * leafGap;
      const topY = centerY - totalSpan / 2;
      for (let i = 0; i < leafCount; i++) leaves.push(topY + i * leafGap);
      const ys = [leaves];
      for (let r = 1; r < rounds; r++) {
        const prev = ys[r - 1];
        const cur = [];
        for (let i = 0; i < prev.length; i += 2) {
          cur.push((prev[i] + prev[i + 1]) / 2);
        }
        ys.push(cur);
      }
      if (side === 'left') {
        for (let i = 0; i < leafCount; i++)
          drawBox(xPositions[0], ys[0][i], boxW, boxH, names[i], true);
        for (let r = 0; r < rounds - 1; r++) {
          for (let i = 0; i < ys[r + 1].length; i++) {
            const y1 = ys[r][i * 2],
              y2 = ys[r][i * 2 + 1],
              parentY = ys[r + 1][i];
            connectorLeft(
              xPositions[r],
              y1,
              xPositions[r],
              y2,
              xPositions[r + 1],
              parentY
            );
            drawBox(xPositions[r + 1], parentY, boxW, boxH, null, true);
          }
        }
      } else {
        for (let i = 0; i < leafCount; i++)
          drawBox(xPositions[0], ys[0][i], boxW, boxH, names[i], false);
        for (let r = 0; r < rounds - 1; r++) {
          for (let i = 0; i < ys[r + 1].length; i++) {
            const y1 = ys[r][i * 2],
              y2 = ys[r][i * 2 + 1],
              parentY = ys[r + 1][i];
            connectorRight(
              xPositions[r],
              y1,
              xPositions[r],
              y2,
              xPositions[r + 1],
              parentY
            );
            drawBox(xPositions[r + 1], parentY, boxW, boxH, null, false);
          }
        }
      }
      return { finalX: xPositions[rounds - 1], finalY: ys[rounds - 1][0] };
    }

    function buildSide24(side, byes, pre) {
      const boxW = 160,
        boxH = 26,
        roundGap = 110,
        leafGap = 52;
      const centerX = canvas.clientWidth / 2;
      const centerY = canvas.clientHeight / 2;
      const rounds = 3; // R16->QF->SF
      const x = [];
      if (side === 'left') {
        const lastX = centerX - 80 - boxW;
        for (let r = rounds - 1; r >= 0; r--)
          x[r] = lastX - (rounds - 1 - r) * roundGap;
      } else {
        const firstX = centerX + 80;
        for (let r = rounds - 1; r >= 0; r--)
          x[r] = firstX + (rounds - 1 - r) * roundGap;
      }
      const preX = side === 'left' ? x[0] - roundGap : x[0] + boxW + roundGap;
      const leafCount2 = 8;
      const totalSpan = (leafCount2 - 1) * leafGap;
      const topY = centerY - totalSpan / 2;
      const yR2 = Array.from(
        { length: leafCount2 },
        (_, i) => topY + i * leafGap
      );
      const yQF = Array.from(
        { length: leafCount2 / 2 },
        (_, i) => (yR2[2 * i] + yR2[2 * i + 1]) / 2
      );
      const ySF = Array.from(
        { length: leafCount2 / 4 },
        (_, i) => (yQF[2 * i] + yQF[2 * i + 1]) / 2
      );

      if (side === 'left') {
        for (let i = 0; i < leafCount2; i++)
          drawBox(x[0], yR2[i], boxW, boxH, null, true);
        for (let i = 0; i < yQF.length; i++) {
          connectorLeft(x[0], yR2[i * 2], x[0], yR2[i * 2 + 1], x[1], yQF[i]);
          drawBox(x[1], yQF[i], boxW, boxH, null, true);
        }
        connectorLeft(x[1], yQF[0], x[1], yQF[1], x[2], ySF[0]);
        drawBox(x[2], ySF[0], boxW, boxH, null, true);
      } else {
        for (let i = 0; i < leafCount2; i++)
          drawBox(x[0], yR2[i], boxW, boxH, null, false);
        for (let i = 0; i < yQF.length; i++) {
          connectorRight(x[0], yR2[i * 2], x[0], yR2[i * 2 + 1], x[1], yQF[i]);
          drawBox(x[1], yQF[i], boxW, boxH, null, false);
        }
        connectorRight(x[1], yQF[0], x[1], yQF[1], x[2], ySF[0]);
        drawBox(x[2], ySF[0], boxW, boxH, null, false);
      }

      const preGap = Math.round(leafGap / 2);
      for (let k = 0; k < 4; k++) {
        const slotIdx = k * 2;
        const centerYSlot = yR2[slotIdx];
        const y1 = centerYSlot - preGap;
        const y2 = centerYSlot + preGap;
        if (side === 'left') {
          drawBox(preX, y1, boxW, boxH, pre[k * 2], true);
          drawBox(preX, y2, boxW, boxH, pre[k * 2 + 1], true);
          connectorLeft(preX, y1, preX, y2, x[0], centerYSlot);
        } else {
          const rightPreX = preX - boxW;
          drawBox(rightPreX, y1, boxW, boxH, pre[k * 2], false);
          drawBox(rightPreX, y2, boxW, boxH, pre[k * 2 + 1], false);
          connectorRight(rightPreX, y1, rightPreX, y2, x[0], centerYSlot);
        }
      }
      for (let k = 0; k < 4; k++) {
        const idx = k * 2 + 1;
        if (side === 'left') drawBox(x[0], yR2[idx], boxW, boxH, byes[k], true);
        else drawBox(x[0], yR2[idx], boxW, boxH, byes[k], false);
      }
      return { finalX: x[2], finalY: ySF[0] };
    }

    function render() {
      fitDPI();
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1.5;

      let leftFinalX, leftFinalY, rightFinalX, rightFinalY;
      if (players.length === 8) {
        const leftNames = players.slice(0, 4);
        const rightNames = players.slice(4, 8);
        ({ finalX: leftFinalX, finalY: leftFinalY } = buildSide(
          'left',
          4,
          leftNames
        ));
        ({ finalX: rightFinalX, finalY: rightFinalY } = buildSide(
          'right',
          4,
          rightNames
        ));
      } else if (players.length === 16) {
        const leftNames = players.slice(0, 8);
        const rightNames = players.slice(8, 16);
        ({ finalX: leftFinalX, finalY: leftFinalY } = buildSide(
          'left',
          8,
          leftNames
        ));
        ({ finalX: rightFinalX, finalY: rightFinalY } = buildSide(
          'right',
          8,
          rightNames
        ));
      } else if (players.length === 24) {
        const byesLeft = players.slice(0, 4);
        const byesRight = players.slice(4, 8);
        const preLeft = players.slice(8, 16);
        const preRight = players.slice(16, 24);
        ({ finalX: leftFinalX, finalY: leftFinalY } = buildSide24(
          'left',
          byesLeft,
          preLeft
        ));
        ({ finalX: rightFinalX, finalY: rightFinalY } = buildSide24(
          'right',
          byesRight,
          preRight
        ));
      }
      drawFinalConnectors(
        leftFinalX,
        leftFinalY,
        rightFinalX,
        rightFinalY,
        W / 2
      );
      const R = 36;
      if (tpcImg.complete) {
        ctx.drawImage(tpcImg, W / 2 - R, H / 2 - R, R * 2, R * 2);
      }
      ctx.font =
        '14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.ink;
      ctx.fillText(`POT: ${pot} TPC`, W / 2, H / 2 + R + 18);
    }

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [search]);

  return (
    <div className="w-full h-[100dvh] p-2" style={{ background: '#0b1220' }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={680}
        className="w-full h-full"
      />
    </div>
  );
}
