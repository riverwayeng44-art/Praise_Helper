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

/**
 * 악보 위 AI 추정 좌표 주변의 실제 인쇄된 잉크 픽셀(어두운 코드 글자)을 정밀 감지하여
 * AI 좌표 편차(우측/하향 쏠림 등)를 픽셀 단위로 자동 스냅 보정합니다.
 */
function findChordInkBounds(
  ctx: CanvasRenderingContext2D,
  approxCenterX: number,
  approxCenterY: number,
  chordText: string,
  standardFontSize: number,
  imgWidth: number,
  imgHeight: number
): { snappedCenterX: number; snappedCenterY: number; inkWidth: number; inkHeight: number; found: boolean } {
  try {
    // 탐색 범위: AI는 시각 패치 특성상 우측 편향 및 오선보 줄 쪽(아래쪽)으로 편향되는 경향이 있음
    // - 좌측 탐색: -65px ~ -75px (우측으로 치우친 AI 좌표를 좌측 실제 글자로 당겨옴)
    // - 우측 탐색: +30px
    // - 상단 탐색: -30px (오선보 줄 위에 걸친 AI 좌표를 상단 실제 코드 글자로 당겨옴)
    // - 하단 탐색: +8px (오선보 줄과 음표 침범 절대 방지)
    const searchPadLeft = Math.max(65, Math.round(standardFontSize * 3.2));
    const searchPadRight = Math.max(30, Math.round(standardFontSize * 1.5));
    const searchPadTop = Math.max(30, Math.round(standardFontSize * 1.5));
    const searchPadBottom = Math.max(8, Math.round(standardFontSize * 0.4));

    const x1 = Math.max(0, Math.floor(approxCenterX - searchPadLeft));
    const x2 = Math.min(imgWidth, Math.ceil(approxCenterX + searchPadRight));
    const y1 = Math.max(0, Math.floor(approxCenterY - searchPadTop));
    const y2 = Math.min(imgHeight, Math.ceil(approxCenterY + searchPadBottom));

    const w = x2 - x1;
    const h = y2 - y1;
    if (w <= 0 || h <= 0) {
      return { snappedCenterX: approxCenterX, snappedCenterY: approxCenterY, inkWidth: 30, inkHeight: 20, found: false };
    }

    const imgData = ctx.getImageData(x1, y1, w, h);
    const data = imgData.data;

    // 1단계: 수평 오선보 줄 감지 및 제외 (탐색창의 75% 이상 연속 어두운 픽셀인 행은 오선보 줄이므로 제외)
    const rowDarkCounts = new Int32Array(h);
    const darkPixels = new Uint8Array(w * h);

    for (let py = 0; py < h; py++) {
      const rowOffset = py * w;
      let darkInRow = 0;
      for (let px = 0; px < w; px++) {
        const idx = (rowOffset + px) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 155) {
          darkPixels[rowOffset + px] = 1;
          darkInRow++;
        }
      }
      rowDarkCounts[py] = darkInRow;
    }

    // 2단계: 유효 코드 잉크 컬럼 추출 (오선보 가로줄 행 제외)
    const colCounts = new Int32Array(w);
    for (let py = 0; py < h; py++) {
      if (rowDarkCounts[py] >= w * 0.75) continue;
      const rowOffset = py * w;
      for (let px = 0; px < w; px++) {
        if (darkPixels[rowOffset + px] === 1) {
          colCounts[px]++;
        }
      }
    }

    // 최소 3픽셀 이상의 높이를 가진 컬럼 추출
    const activeCols: number[] = [];
    for (let x = 0; x < w; x++) {
      if (colCounts[x] >= 3) {
        activeCols.push(x);
      }
    }

    if (activeCols.length === 0) {
      return { snappedCenterX: approxCenterX, snappedCenterY: approxCenterY, inkWidth: 30, inkHeight: 20, found: false };
    }

    // 3단계: 컬럼들을 글자 덩어리(span)로 그룹화 (최대 9px 자간 허용)
    const maxGap = Math.max(9, Math.round(standardFontSize * 0.45));
    const spans: { start: number; end: number }[] = [];
    let curStart = activeCols[0];
    let curEnd = activeCols[0];

    for (let i = 1; i < activeCols.length; i++) {
      if (activeCols[i] - curEnd <= maxGap) {
        curEnd = activeCols[i];
      } else {
        if (curEnd - curStart >= 4) {
          spans.push({ start: curStart, end: curEnd });
        }
        curStart = activeCols[i];
        curEnd = activeCols[i];
      }
    }
    if (curEnd - curStart >= 4) {
      spans.push({ start: curStart, end: curEnd });
    }

    if (spans.length === 0) {
      return { snappedCenterX: approxCenterX, snappedCenterY: approxCenterY, inkWidth: 30, inkHeight: 20, found: false };
    }

    // 4단계: 다중 글자 코드(Em7, G/B 등)에서 슬래시(/)나 자간으로 분리된 span들을 하나의 코드로 병합
    const expectedW = Math.max(14, Math.round((chordText?.length || 2) * standardFontSize * 0.55));
    const mergeThreshold = Math.max(12, Math.round(standardFontSize * 0.6));
    const mergedSpans: { start: number; end: number }[] = [];
    let i = 0;
    while (i < spans.length) {
      let mStart = spans[i].start;
      let mEnd = spans[i].end;
      while (i + 1 < spans.length && (spans[i + 1].start - mEnd) <= mergeThreshold) {
        const combW = spans[i + 1].end - mStart;
        if (combW <= expectedW * 1.55) {
          mEnd = spans[i + 1].end;
          i++;
        } else {
          break;
        }
      }
      mergedSpans.push({ start: mStart, end: mEnd });
      i++;
    }

    // 5단계: approxCenterX와 가장 가까우면서 코드 예상 폭을 만족하는 최적 span 선택
    let bestSpan = mergedSpans[0];
    let bestDist = 99999;
    for (const span of mergedSpans) {
      const spanCenterGlobal = x1 + (span.start + span.end) / 2;
      const dist = Math.abs(spanCenterGlobal - approxCenterX);
      if (dist < bestDist) {
        bestDist = dist;
        bestSpan = span;
      }
    }

    const actualX1 = x1 + bestSpan.start;
    const actualX2 = x1 + bestSpan.end;
    const actualW = actualX2 - actualX1;
    const actualCenterX = (actualX1 + actualX2) / 2;

    // 6단계: 선택된 span 내부에서 수직 Y 범위 정밀 감지 (상단 작곡가 텍스트나 가사와 분리된 독립 행 구간 선택)
    const spanRowCounts = new Int32Array(h);
    for (let py = 0; py < h; py++) {
      if (rowDarkCounts[py] >= w * 0.75) continue;
      const rowOffset = py * w;
      for (let px = bestSpan.start; px <= bestSpan.end; px++) {
        if (darkPixels[rowOffset + px] === 1) {
          spanRowCounts[py]++;
        }
      }
    }

    const actRowIdxs: number[] = [];
    for (let py = 0; py < h; py++) {
      if (spanRowCounts[py] >= 2) {
        actRowIdxs.push(py);
      }
    }

    if (actRowIdxs.length === 0) {
      return { snappedCenterX: actualCenterX, snappedCenterY: approxCenterY, inkWidth: actualW, inkHeight: 20, found: true };
    }

    // 수직 연속 구간 분리 (4px 이상 빈 공간이 있으면 서로 다른 요소로 구분)
    const rowSegments: { start: number; end: number }[] = [];
    let rStart = actRowIdxs[0];
    let rEnd = actRowIdxs[0];
    for (let r = 1; r < actRowIdxs.length; r++) {
      if (actRowIdxs[r] - rEnd <= 4) {
        rEnd = actRowIdxs[r];
      } else {
        rowSegments.push({ start: rStart, end: rEnd });
        rStart = actRowIdxs[r];
        rEnd = actRowIdxs[r];
      }
    }
    rowSegments.push({ start: rStart, end: rEnd });

    // approxCenterY와 가장 가까운 행 구간 선택 (상단 채보 텍스트 등과 간섭 방지)
    let bestRSeg = rowSegments[0];
    let bestRDist = 99999;
    for (const rSeg of rowSegments) {
      const segCenterGlobal = y1 + (rSeg.start + rSeg.end) / 2;
      const dist = Math.abs(segCenterGlobal - approxCenterY);
      if (dist < bestRDist) {
        bestRDist = dist;
        bestRSeg = rSeg;
      }
    }

    const actualY1 = y1 + bestRSeg.start;
    const actualY2 = y1 + bestRSeg.end;
    const actualH = Math.max(16, actualY2 - actualY1 + 1);
    const actualCenterY = (actualY1 + actualY2) / 2;

    return {
      snappedCenterX: actualCenterX,
      snappedCenterY: actualCenterY,
      inkWidth: actualW,
      inkHeight: actualH,
      found: true,
    };
  } catch (err) {
    return { snappedCenterX: approxCenterX, snappedCenterY: approxCenterY, inkWidth: 30, inkHeight: 20, found: false };
  }
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

      let centerX = bx + bw / 2;
      let centerY = by + bh / 2;

      // AI 코드인 경우 실제 악보 인쇄 잉크 위치로 픽셀 단위 자동 스냅
      const isAiChord = item.id.startsWith('ai-chord-');
      const ink = isAiChord
        ? findChordInkBounds(ctx, centerX, centerY, item.chordText, standardFontSize, width, height)
        : { snappedCenterX: centerX, snappedCenterY: centerY, inkWidth: bw, inkHeight: bh, found: false };

      if (ink.found) {
        centerX = ink.snappedCenterX;
        centerY = ink.snappedCenterY;
      }

      const displayChord = isKeyChanged
        ? transposeChord(item.chordText, semitones, preferFlat)
        : item.chordText;

      const chordFontSize = standardFontSize;
      ctx.font = `bold ${chordFontSize}px 'Jua', sans-serif`;

      // 원본 코드 텍스트 및 변경된 코드 텍스트 길이 측정
      const origMetrics = ctx.measureText(item.chordText);
      const newMetrics = ctx.measureText(displayChord);

      // 원본 코드를 충분히 가릴 수 있는 마스킹 영역 (실제 잉크 폭 및 텍스트 폭 모두 커버)
      const maxTextWidth = Math.max(origMetrics.width, newMetrics.width, ink.found ? ink.inkWidth : 0);
      const padX = Math.max(6, Math.round(chordFontSize * 0.25));
      const padY = Math.max(4, Math.round(chordFontSize * 0.18));

      const inpaintW = Math.max(bw, Math.round(maxTextWidth + padX * 2));
      const inpaintH = Math.max(bh, Math.round(Math.max(chordFontSize, ink.found ? ink.inkHeight : 0) + padY * 2));
      
      let inpaintX = Math.round(centerX - inpaintW / 2);
      // 스냅 미검출 fallback 시 AI의 우측 편향 보정을 위해 좌측으로 4~6px 추가 커버
      if (!ink.found && isAiChord) {
        inpaintX -= Math.max(4, Math.round(chordFontSize * 0.18));
      }
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

      const fontChoice = tb.fontFamily || 'Jua';
      ctx.font = `bold ${fontSize}px '${fontChoice}', sans-serif`;
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
      const defaultStroke = Math.max(2, Math.min(8, Math.round(Math.min(aw, ah) * 0.12)));
      const strokeWidth = anno.strokeWidth || defaultStroke || 4;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const cx = ax + aw / 2;
      const cy = ay + ah / 2;

      switch (anno.iconType) {
        case 'bar': // 세로 막대기 |
          ctx.beginPath();
          ctx.moveTo(cx, ay + 2);
          ctx.lineTo(cx, ay + ah - 2);
          ctx.stroke();
          break;

        case 'check': // 롱 테일 체크마크 ✓ (한쪽이 더 긴 체크)
          ctx.beginPath();
          ctx.moveTo(ax + aw * 0.15, ay + ah * 0.52);
          ctx.lineTo(ax + aw * 0.40, ay + ah * 0.82);
          ctx.lineTo(ax + aw * 0.90, ay + ah * 0.18);
          ctx.stroke();
          break;

        case 'paren_open': // 여는 괄호 ( - 상하로 늘어나도 박스를 벗어나지 않는 베지에 곡선
          ctx.beginPath();
          ctx.moveTo(ax + aw * 0.82, ay + 2);
          ctx.quadraticCurveTo(ax + aw * 0.08, cy, ax + aw * 0.82, ay + ah - 2);
          ctx.stroke();
          break;

        case 'paren_close': // 닫는 괄호 ) - 상하로 늘어나도 박스를 벗어나지 않는 베지에 곡선
          ctx.beginPath();
          ctx.moveTo(ax + aw * 0.18, ay + 2);
          ctx.quadraticCurveTo(ax + aw * 0.92, cy, ax + aw * 0.18, ay + ah - 2);
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
