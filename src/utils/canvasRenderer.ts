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
    // 박스 외곽 8개 지점을 탐색하여 가장 밝은(흰색에 가까운) 종이 색상 선택 (회색 박스 방지)
    const samplePoints = [
      { x: box.x - 5, y: box.y - 5 },
      { x: box.x + box.width + 5, y: box.y - 5 },
      { x: box.x - 5, y: box.y + box.height + 5 },
      { x: box.x + box.width + 5, y: box.y + box.height + 5 },
      { x: box.x + box.width / 2, y: box.y - 6 },
      { x: box.x - 6, y: box.y + box.height / 2 },
      { x: box.x + box.width + 6, y: box.y + box.height / 2 },
    ];

    let maxLuminance = -1;
    let brightestColor = '#ffffff';

    for (const pt of samplePoints) {
      const sx = Math.min(Math.max(0, Math.floor(pt.x)), imgWidth - 1);
      const sy = Math.min(Math.max(0, Math.floor(pt.y)), imgHeight - 1);
      const pixel = ctx.getImageData(sx, sy, 1, 1).data;
      const luminance = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];

      // 어두운 선이나 음표는 제외하고 깨끗한 종이 바탕(200 이상)만 채택
      if (luminance >= 200 && luminance > maxLuminance) {
        maxLuminance = luminance;
        brightestColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
      }
    }

    if (maxLuminance >= 200) {
      return brightestColor;
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
 * - 원본 코드 영역을 정확하게 가리고 새 키의 코드를 정중앙에 렌더링
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

      // 인페인팅 크기: 원본 코드를 완전히 가릴 수 있도록 여유 마진(+6px) 부여
      const inpaintW = Math.max(bw + 6, measuredWidth + padX * 2);
      const inpaintH = Math.max(bh + 4, chordFontSize + padY * 2);
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

      const { r, g, b, hex } = normalizeColor(hl.color || getHighlightColorForLabel(hl.label));

      ctx.save();
      // 1. 악보 마디 영역 하이라이트 (투명한 배경 채우기 + 선명한 외곽선)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
      ctx.lineWidth = Math.max(2.5, Math.round(width * 0.0025));

      drawRoundedRect(ctx, hx, hy, hw, hh, Math.min(8, Math.round(hh * 0.15)));
      ctx.fill();
      ctx.stroke();

      // 2. 상단 세션 가이드 배지 태그 (100% 불투명 솔리드 컬러 + 고대비 글씨)
      if (hl.label) {
        const badgeFontSize = Math.max(14, Math.min(Math.round(height * 0.014), 24));
        ctx.font = `bold ${badgeFontSize}px 'Jua', sans-serif`;

        const badgePaddingX = 10;
        const badgePaddingY = 5;
        const textMetrics = ctx.measureText(hl.label);
        const badgeWidth = textMetrics.width + badgePaddingX * 2;
        const badgeHeight = badgeFontSize + badgePaddingY * 2;

        const badgeX = hx + 4;
        const badgeY = Math.max(4, hy - badgeHeight - 3);

        // 배지 배경: 100% 불투명 솔리드 배경 (악보 배경색에 관계없이 선명)
        ctx.fillStyle = hex;
        drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 6);
        ctx.fill();

        // 얇은 외곽선으로 배지 입체감 부여
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 배지 텍스트: 밝은 배경은 어두운 글씨, 어두운 배경은 순백색 글씨
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        ctx.fillStyle = luminance > 185 ? '#0f172a' : '#ffffff';
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
  if (l.includes('드럼') || l.includes('drum')) return '#f59e0b'; // 주황/호박색
  if (l.includes('브레이크') || l.includes('break') || l.includes('stop')) return '#ef4444'; // 레드
  if (l.includes('빌드업') || l.includes('buildup') || l.includes('고조')) return '#8b5cf6'; // 퍼플
  if (l.includes('어쿠스틱') || l.includes('acoustic') || l.includes('잔잔') || l.includes('기타')) return '#06b6d4'; // 시안
  if (l.includes('풀') || l.includes('full') || l.includes('투티') || l.includes('코러스')) return '#10b981'; // 에메랄드
  if (l.includes('피아노') || l.includes('건반') || l.includes('solo')) return '#ec4899'; // 핑크
  if (l.includes('보컬') || l.includes('vocal')) return '#6366f1'; // 인디고
  return '#2563eb'; // 블루
}

function normalizeColor(colorStr: string): { r: number; g: number; b: number; hex: string } {
  if (!colorStr) return { r: 37, g: 99, b: 235, hex: '#2563eb' };

  // rgba(r, g, b, a) 또는 rgb(r, g, b) 형태 지원
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10)));
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { r, g, b, hex };
  }

  // #hex 형태 지원
  const cleanHex = colorStr.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) || 37;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) || 99;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) || 235;
    return { r, g, b, hex: `#${cleanHex[0]}${cleanHex[0]}${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}` };
  }
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) || 37;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 99;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 235;
    return { r, g, b, hex: `#${cleanHex.substring(0, 6)}` };
  }

  return { r: 37, g: 99, b: 235, hex: '#2563eb' };
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
