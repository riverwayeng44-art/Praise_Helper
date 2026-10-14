import { ChordItem, HighlightArea, TextBoxItem, AnnotationIconItem } from '../types';
import { getSemitoneDiff, transposeChord, FLAT_DOMINANT_KEYS } from './transposer';
import { getContrastTextColor, removeEmoji, createTranslucentColor } from './colorUtils';

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
 * 악보의 배경색 샘플링 (가장 밝고 깨끗한 종이 바탕색 추출하여 회색 박스 방지)
 */
function sampleBackgroundColor(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  imgWidth: number,
  imgHeight: number
): string {
  try {
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
  textBoxes?: TextBoxItem[];
  annotations?: AnnotationIconItem[];
  showHighlights?: boolean;
}

/**
 * 원본 해상도 100% 무손실 캔버스 렌더러
 * - 원본 코드 영역을 정확하게 가리고 새 키의 코드를 정중앙에 렌더링
 * - 사용자 지정 테두리/배경색 및 자동 흑백 대비 가이드 라벨 렌더링
 * - 글상자 및 악보 기호 아이콘 (|, ✓, (, )) 렌더링
 */
export async function renderTransposedSheetMusic({
  originalImage,
  chords,
  fromKey,
  toKey,
  sessionHighlights = [],
  textBoxes = [],
  annotations = [],
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

  // 2. 코드 렌더링 (2-Pass 방식: 1단계 - 모든 기존 코드 위치를 종이색으로 완벽 마스킹, 2단계 - 여백 없이 새 코드 텍스트만 렌더링)
  if (chords && chords.length > 0) {
    const chordRenderData: {
      item: ChordItem;
      centerX: number;
      centerY: number;
      displayChord: string;
      inpaintX: number;
      inpaintY: number;
      inpaintW: number;
      inpaintH: number;
      bgColor: string;
      shouldRender: boolean;
    }[] = [];

    // [Pass 1 준비: 각 코드의 마스킹 영역 계산 및 배경색 샘플링]
    for (const item of chords) {
      if (!item.chordText) continue;

      const box = item.box;
      const bx = box.x <= 1 ? box.x * width : box.x;
      const by = box.y <= 1 ? box.y * height : box.y;
      const bw = box.width <= 1 ? box.width * width : box.width;
      const bh = box.height <= 1 ? box.height * height : box.height;

      const centerX = bx + bw / 2;
      const centerY = by + bh / 2;

      const displayChord = isKeyChanged
        ? transposeChord(item.chordText, semitones, preferFlat)
        : item.chordText;

      const chordFontSize = standardFontSize;
      ctx.font = `bold ${chordFontSize}px 'Jua', sans-serif`;

      // 원본 코드 텍스트 및 변경된 코드 텍스트 길이 측정
      const origMetrics = ctx.measureText(item.chordText);
      const newMetrics = ctx.measureText(displayChord);

      // 원본 코드를 충분히 가릴 수 있는 최소 마스킹 영역 (불필요한 과도한 좌우 여백을 줄여 인접 코드 간섭 최소화)
      const maxTextWidth = Math.max(origMetrics.width, newMetrics.width);
      const padX = Math.max(3, Math.round(chordFontSize * 0.15));
      const padY = 3;

      const inpaintW = Math.max(bw, Math.round(maxTextWidth + padX * 2));
      const inpaintH = Math.max(bh, Math.round(chordFontSize + padY * 2));
      const inpaintX = Math.round(centerX - inpaintW / 2);
      const inpaintY = Math.round(centerY - inpaintH / 2);

      const shouldRender = isKeyChanged || item.id.startsWith('manual-') || item.id.startsWith('chord-') || item.id.startsWith('ai-chord-');
      const bgColor = sampleBackgroundColor(ctx, { x: inpaintX, y: inpaintY, width: inpaintW, height: inpaintH }, width, height);

      chordRenderData.push({
        item,
        centerX,
        centerY,
        displayChord,
        inpaintX,
        inpaintY,
        inpaintW,
        inpaintH,
        bgColor,
        shouldRender,
      });
    }

    // [Pass 1 실행: 모든 코드를 먼저 종이 바탕색으로 '전부 가리기']
    for (const data of chordRenderData) {
      if (data.shouldRender) {
        ctx.fillStyle = data.bgColor;
        ctx.fillRect(data.inpaintX, data.inpaintY, data.inpaintW, data.inpaintH);
      }
    }

    // [Pass 2 실행: 모든 코드가 가려진 깨끗한 악보 위에 여백 없이 순수 텍스트만 렌더링 (인접 코드를 가리는 흰 박스 완전 차단)]
    ctx.font = `bold ${standardFontSize}px 'Jua', sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const data of chordRenderData) {
      if (data.shouldRender) {
        ctx.fillText(data.displayChord, data.centerX, data.centerY);
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

      // 사용자 정의 색상 우선 적용
      const borderColor = hl.borderColor || hl.color || '#3b82f6';
      const bgColor = hl.backgroundColor || createTranslucentColor(borderColor, 0.2);
      const textColor = hl.textColor || getContrastTextColor(borderColor);

      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = Math.max(2, Math.round(width * 0.0022));

      drawRoundedRect(ctx, hx, hy, hw, hh, Math.min(8, Math.round(hh * 0.14)));
      ctx.fill();
      ctx.stroke();

      // 배지 라벨 (아이콘/이모지 제거, 테두리 밖 상단에 접하도록 위로 올려서 배치)
      const cleanLabel = removeEmoji(hl.label);
      if (cleanLabel) {
        const badgeFontSize = Math.max(13, Math.min(Math.round(height * 0.013), 22));
        ctx.font = `bold ${badgeFontSize}px 'Jua', sans-serif`;

        const badgePaddingX = 8;
        const badgePaddingY = 3;
        const textMetrics = ctx.measureText(cleanLabel);
        const badgeWidth = textMetrics.width + badgePaddingX * 2;
        const badgeHeight = badgeFontSize + badgePaddingY * 2;

        const badgeX = hx + 4;
        // 테두리 밖 상단에 딱 접하도록 배치
        const badgeY = Math.max(2, hy - badgeHeight - 2);

        // 뱃지 배경 (테두리 색상)
        ctx.fillStyle = borderColor;
        drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();

        // 뱃지 텍스트 (밝기 인식하여 검은 글씨 / 하얀 글씨 자동 대비)
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(cleanLabel, badgeX + badgePaddingX, badgeY + badgeHeight / 2 + 1);
      }

      ctx.restore();
    }
  }

  // 4. 글상자 (Text Box) 렌더링
  if (textBoxes && textBoxes.length > 0) {
    for (const tb of textBoxes) {
      if (!tb.text || !tb.box) continue;
      const box = tb.box;
      const tx = box.x <= 1 ? box.x * width : box.x;
      const ty = box.y <= 1 ? box.y * height : box.y;
      const tw = box.width <= 1 ? box.width * width : box.width;
      const th = box.height <= 1 ? box.height * height : box.height;

      const textColor = tb.color || '#2563eb'; // 기본 파랑
      const fontSize = tb.fontSize || Math.max(16, Math.min(Math.round(height * 0.015), 26));

      ctx.save();

      // 반투명 배경 (설정된 경우)
      if (tb.backgroundColor && tb.backgroundColor !== 'transparent') {
        ctx.fillStyle = tb.backgroundColor;
        drawRoundedRect(ctx, tx, ty, tw, th, 6);
        ctx.fill();
      }

      ctx.font = `bold ${fontSize}px 'Jua', sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      const lines = tb.text.split('\n');
      const lineHeight = fontSize * 1.35;
      lines.forEach((line, i) => {
        ctx.fillText(line, tx + 6, ty + 6 + i * lineHeight);
      });

      ctx.restore();
    }
  }

  // 5. 악보 기호 아이콘 (Annotations: |, ✓, (, )) 렌더링
  if (annotations && annotations.length > 0) {
    for (const anno of annotations) {
      if (!anno.box) continue;
      const box = anno.box;
      const ax = box.x <= 1 ? box.x * width : box.x;
      const ay = box.y <= 1 ? box.y * height : box.y;
      const aw = box.width <= 1 ? box.width * width : box.width;
      const ah = box.height <= 1 ? box.height * height : box.height;

      const color = anno.color || '#ef4444'; // 기본 빨강

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const cx = ax + aw / 2;
      const cy = ay + ah / 2;

      switch (anno.iconType) {
        case 'bar': // 세로 막대기 |
          ctx.lineWidth = Math.max(3, Math.round(aw * 0.35));
          ctx.beginPath();
          ctx.moveTo(cx, ay + 2);
          ctx.lineTo(cx, ay + ah - 2);
          ctx.stroke();
          break;

        case 'check': // 롱 테일 체크마크 ✓ (한쪽이 더 긴 체크)
          ctx.lineWidth = Math.max(3, Math.round(Math.min(aw, ah) * 0.12));
          ctx.beginPath();
          ctx.moveTo(ax + aw * 0.15, ay + ah * 0.52);
          ctx.lineTo(ax + aw * 0.40, ay + ah * 0.82);
          ctx.lineTo(ax + aw * 0.90, ay + ah * 0.18);
          ctx.stroke();
          break;

        case 'paren_open': // 여는 괄호 (
          ctx.lineWidth = Math.max(3, Math.round(aw * 0.22));
          ctx.beginPath();
          ctx.arc(ax + aw * 0.85, cy, ah * 0.48, Math.PI * 0.65, Math.PI * 1.35, false);
          ctx.stroke();
          break;

        case 'paren_close': // 닫는 괄호 )
          ctx.lineWidth = Math.max(3, Math.round(aw * 0.22));
          ctx.beginPath();
          ctx.arc(ax + aw * 0.15, cy, ah * 0.48, Math.PI * 1.65, Math.PI * 0.35, false);
          ctx.stroke();
          break;
      }

      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
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
