import { ChordItem, HighlightArea } from '../types';
import { getSemitoneDiff, transposeChord, FLAT_DOMINANT_KEYS } from './transposer';

export async function ensureFontLoaded(fontFamily = 'Jua'): Promise<void> {
  if ('fonts' in document) {
    try {
      await document.fonts.load(`16px ${fontFamily}`);
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check warning:', e);
    }
  }
}

/**
 * 악보의 배경색 샘플링 (주변 흰색/미색 바탕색 추출)
 */
function sampleBackgroundColor(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  imgWidth: number,
  imgHeight: number
): string {
  try {
    const samplePoints = [
      { x: box.x - 3, y: box.y - 3 },
      { x: box.x + box.width + 3, y: box.y - 3 },
      { x: box.x, y: box.y - 2 },
    ];

    for (const pt of samplePoints) {
      const sx = Math.min(Math.max(0, Math.floor(pt.x)), imgWidth - 1);
      const sy = Math.min(Math.max(0, Math.floor(pt.y)), imgHeight - 1);
      const pixel = ctx.getImageData(sx, sy, 1, 1).data;
      const luminance = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
      if (luminance > 180) {
        return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      }
    }
  } catch (err) {
    // fallback
  }
  return '#ffffff';
}

interface RenderOptions {
  originalImage: HTMLImageElement;
  chords: ChordItem[];
  fromKey: string;
  toKey: string;
  sessionHighlights?: HighlightArea[];
  showHighlights?: boolean;
}

/**
 * 원본 해상도 100% 무손실 캔버스 렌더러
 * - 코드: 텍스트 중앙 정렬, 좌우 스페이스 2개 정도의 컴팩트한 여백 (G -> [  G  ])
 * - 불필요하게 긴 흰색 공백을 완전히 없애고 악보를 가리지 않음
 */
export async function renderTransposedSheetMusic({
  originalImage,
  chords,
  fromKey,
  toKey,
  sessionHighlights = [],
  showHighlights = true,
}: RenderOptions): Promise<string> {
  await ensureFontLoaded('Jua');

  const width = originalImage.naturalWidth || originalImage.width || 1200;
  const height = originalImage.naturalHeight || originalImage.height || 1700;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. 원본 이미지 100% 해상도 그대로 복사
  ctx.drawImage(originalImage, 0, 0, width, height);

  const semitones = getSemitoneDiff(fromKey, toKey);
  const preferFlat = FLAT_DOMINANT_KEYS.has(toKey);
  const isKeyChanged = semitones !== 0;

  // 악보 전체 높이에 비례한 표준 코드 폰트 기준 크기 (20~32px)
  const standardFontSize = Math.max(18, Math.min(Math.round(height * 0.017), 32));

  // 2. 코드 렌더링
  if (chords && chords.length > 0) {
    for (const item of chords) {
      if (!item.chordText) continue;

      const box = item.box;
      const bx = box.x <= 1 ? box.x * width : box.x;
      const by = box.y <= 1 ? box.y * height : box.y;
      const bw = box.width <= 1 ? box.width * width : box.width;
      const bh = box.height <= 1 ? box.height * height : box.height;

      // 박스의 중심 좌표 (가로/세로 완전 중앙 정렬의 기준점)
      const centerX = bx + bw / 2;
      const centerY = by + bh / 2;

      // 새 코드 텍스트
      const displayChord = isKeyChanged
        ? transposeChord(item.chordText, semitones, preferFlat)
        : item.chordText;

      const chordFontSize = standardFontSize;
      ctx.font = `bold ${chordFontSize}px 'Jua', sans-serif`;

      const textMetrics = ctx.measureText(displayChord);
      const measuredWidth = textMetrics.width;

      // 스페이스바 2개 정도의 좌우 여백 (약 8~10px)
      const padX = Math.max(8, Math.round(chordFontSize * 0.35));
      const padY = 4;

      // 인페인팅 크기: 최소 텍스트 폭+여백, 박스 크기가 더 크면 박스에 맞춤
      const inpaintW = Math.max(bw, measuredWidth + padX * 2);
      const inpaintH = Math.max(bh, chordFontSize + padY * 2);
      const inpaintX = centerX - inpaintW / 2;
      const inpaintY = centerY - inpaintH / 2;

      // 키가 변경되었거나 사용자가 추가/수정한 코드인 경우 인페인팅 적용
      if (isKeyChanged || item.id.startsWith('manual-') || item.id.startsWith('chord-')) {
        const bgColor = sampleBackgroundColor(ctx, { x: inpaintX, y: inpaintY, width: inpaintW, height: inpaintH }, width, height);
        ctx.fillStyle = bgColor;

        // 박스 중심 기준으로 인페인팅
        ctx.fillRect(inpaintX, inpaintY, inpaintW, inpaintH);

        // 새 코드 텍스트 박스 정중앙 정렬 렌더링
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayChord, centerX, centerY);
      }
    }
  }

  // 3. 세션 가이드 하이라이트 렌더링 (showHighlights가 true일 때만)
  if (showHighlights && sessionHighlights && sessionHighlights.length > 0) {
    for (const hl of sessionHighlights) {
      if (!hl.box) continue;
      const box = hl.box;
      const hx = box.x <= 1 ? box.x * width : box.x;
      const hy = box.y <= 1 ? box.y * height : box.y;
      const hw = box.width <= 1 ? box.width * width : box.width;
      const hh = box.height <= 1 ? box.height * height : box.height;

      const baseColor = hl.color || getHighlightColorForLabel(hl.label);

      ctx.save();
      ctx.fillStyle = hexToRgba(baseColor, 0.18);
      ctx.strokeStyle = hexToRgba(baseColor, 0.75);
      ctx.lineWidth = Math.max(2, Math.round(width * 0.002));

      drawRoundedRect(ctx, hx, hy, hw, hh, Math.min(10, Math.round(hh * 0.15)));
      ctx.fill();
      ctx.stroke();

      // 배지 라벨
      if (hl.label) {
        const badgeFontSize = Math.max(13, Math.min(Math.round(height * 0.013), 22));
        ctx.font = `bold ${badgeFontSize}px 'Jua', sans-serif`;

        const badgePaddingX = 9;
        const badgePaddingY = 4;
        const textMetrics = ctx.measureText(hl.label);
        const badgeWidth = textMetrics.width + badgePaddingX * 2;
        const badgeHeight = badgeFontSize + badgePaddingY * 2;

        const badgeX = hx + 5;
        const badgeY = Math.max(0, hy - badgeHeight + 5);

        ctx.fillStyle = baseColor;
        drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 5);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(hl.label, badgeX + badgePaddingX, badgeY + badgeHeight / 2);
      }

      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

export function getHighlightColorForLabel(label: string): string {
  const l = (label || '').toLowerCase();
  if (l.includes('드럼') || l.includes('drum')) return '#f59e0b';
  if (l.includes('브레이크') || l.includes('break') || l.includes('stop')) return '#ef4444';
  if (l.includes('빌드업') || l.includes('buildup') || l.includes('고조')) return '#8b5cf6';
  if (l.includes('어쿠스틱') || l.includes('quiet') || l.includes('잔잔')) return '#06b6d4';
  if (l.includes('풀') || l.includes('full') || l.includes('투티')) return '#10b981';
  if (l.includes('피아노') || l.includes('건반')) return '#ec4899';
  return '#3b82f6';
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(clean.substring(0, 2), 16) || 59;
  const g = parseInt(clean.substring(2, 4), 16) || 130;
  const b = parseInt(clean.substring(4, 6), 16) || 246;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
