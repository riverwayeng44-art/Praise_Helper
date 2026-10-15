/**
 * 악보 손글씨 필기 감지 및 깔끔 복원 (악보 클린 엔진)
 */

export interface CleanOptions {
  preserveStaffLines?: boolean;
}

/**
 * 이미지의 특정 영역을 잘라내어 dataURL로 반환 (모달 미리보기용)
 */
export function cropImageSnippet(
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number }
): string {
  const canvas = document.createElement('canvas');
  const w = Math.max(10, Math.round(box.width));
  const h = Math.max(10, Math.round(box.height));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = Math.max(0, Math.min(img.naturalWidth - w, Math.round(box.x)));
  const sy = Math.max(0, Math.min(img.naturalHeight - h, Math.round(box.y)));

  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/**
 * 사용자가 선택한 악보 영역 내의 필기/낙서를 감지하여 오선보/기본 악보를 손상시키지 않고 클린 복원
 */
export async function cleanSheetHandwriting(
  img: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  options: CleanOptions = { preserveStaffLines: true }
): Promise<string> {
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 원본 이미지 100% 해상도 복사
  ctx.drawImage(img, 0, 0, w, h);

  const bx = Math.max(0, Math.min(w - 10, Math.round(box.x)));
  const by = Math.max(0, Math.min(h - 10, Math.round(box.y)));
  const bw = Math.max(10, Math.min(w - bx, Math.round(box.width)));
  const bh = Math.max(10, Math.min(h - by, Math.round(box.height)));

  const imgData = ctx.getImageData(bx, by, bw, bh);
  const data = imgData.data;

  // 1. 박스 주변 배경 종이색 샘플링 (가장 밝고 깨끗한 종이 흰색 산출)
  let sumR = 0, sumG = 0, sumB = 0, brightCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum >= 225) {
      sumR += r;
      sumG += g;
      sumB += b;
      brightCount++;
    }
  }

  const bgR = brightCount > 10 ? Math.round(sumR / brightCount) : 255;
  const bgG = brightCount > 10 ? Math.round(sumG / brightCount) : 255;
  const bgB = brightCount > 10 ? Math.round(sumB / brightCount) : 255;

  // 2. 박스 좌측 및 우측 외부 영역을 샘플링하여 오선보 줄 위치(Y좌표)를 완벽하게 탐지
  const isStaffRow = new Array(bh).fill(false);
  const staffLineColors: ({ r: number; g: number; b: number } | null)[] = new Array(bh).fill(null);

  if (options.preserveStaffLines) {
    const leftSampleWidth = Math.min(60, bx);
    const rightSampleWidth = Math.min(60, w - (bx + bw));

    let leftData: Uint8ClampedArray | null = null;
    let rightData: Uint8ClampedArray | null = null;

    if (leftSampleWidth > 15) {
      leftData = ctx.getImageData(bx - leftSampleWidth, by, leftSampleWidth, bh).data;
    }
    if (rightSampleWidth > 15) {
      rightData = ctx.getImageData(bx + bw, by, rightSampleWidth, bh).data;
    }

    for (let y = 0; y < bh; y++) {
      let isLeftStaff = false;
      let isRightStaff = false;
      let leftR = 60, leftG = 60, leftB = 60;
      let rightR = 60, rightG = 60, rightB = 60;

      if (leftData && leftSampleWidth > 15) {
        let darkCount = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        for (let x = 0; x < leftSampleWidth; x++) {
          const idx = (y * leftSampleWidth + x) * 4;
          const lum = 0.299 * leftData[idx] + 0.587 * leftData[idx + 1] + 0.114 * leftData[idx + 2];
          if (lum < 170) {
            darkCount++;
            sumR += leftData[idx];
            sumG += leftData[idx + 1];
            sumB += leftData[idx + 2];
          }
        }
        if (darkCount > leftSampleWidth * 0.4) {
          isLeftStaff = true;
          leftR = Math.round(sumR / darkCount);
          leftG = Math.round(sumG / darkCount);
          leftB = Math.round(sumB / darkCount);
        }
      }

      if (rightData && rightSampleWidth > 15) {
        let darkCount = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        for (let x = 0; x < rightSampleWidth; x++) {
          const idx = (y * rightSampleWidth + x) * 4;
          const lum = 0.299 * rightData[idx] + 0.587 * rightData[idx + 1] + 0.114 * rightData[idx + 2];
          if (lum < 170) {
            darkCount++;
            sumR += rightData[idx];
            sumG += rightData[idx + 1];
            sumB += rightData[idx + 2];
          }
        }
        if (darkCount > rightSampleWidth * 0.4) {
          isRightStaff = true;
          rightR = Math.round(sumR / darkCount);
          rightG = Math.round(sumG / darkCount);
          rightB = Math.round(sumB / darkCount);
        }
      }

      // 좌측 또는 우측에서 오선보 선이 감지된 경우 (또는 박스 내부 자체에서 긴 수평선이 있는 경우)
      if (isLeftStaff || isRightStaff) {
        isStaffRow[y] = true;
        const avgR = isLeftStaff && isRightStaff ? Math.round((leftR + rightR) / 2) : (isLeftStaff ? leftR : rightR);
        const avgG = isLeftStaff && isRightStaff ? Math.round((leftG + rightG) / 2) : (isLeftStaff ? leftG : rightG);
        const avgB = isLeftStaff && isRightStaff ? Math.round((leftB + rightB) / 2) : (isLeftStaff ? leftB : rightB);
        staffLineColors[y] = { r: avgR, g: avgG, b: avgB };
      }
    }

    // 인접한 1~2px 오선보 두께 보정 (오선보가 2~3px 두께인 경우 상하 인접행 보호)
    for (let y = 1; y < bh - 1; y++) {
      if (isStaffRow[y] && !isStaffRow[y - 1] && !isStaffRow[y + 1]) {
        // 단독 1px 줄
      } else if (isStaffRow[y] && isStaffRow[y + 1]) {
        if (!staffLineColors[y + 1] && staffLineColors[y]) {
          staffLineColors[y + 1] = staffLineColors[y];
        }
      }
    }
  }

  // 3. 필기 지우기 처리: 유색 잉크 필기(파랑/빨강/연필) 감지
  let coloredPixelCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const diff = maxC - minC;
    const isBlue = (b > r + 5 && b > g + 3) || (b > 100 && (b - minC) > 6);
    const isRed = (r > g + 8 && r > b + 8);
    if (isBlue || isRed || (diff > 8 && maxC > 70 && maxC < 240)) {
      coloredPixelCount++;
    }
  }

  const hasColoredHandwriting = coloredPixelCount > 15;

  for (let y = 0; y < bh; y++) {
    const isStaff = isStaffRow[y];
    const staffColor = staffLineColors[y] || { r: 60, g: 60, b: 60 };

    for (let x = 0; x < bw; x++) {
      const idx = (y * bw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const diff = maxC - minC;

      // 파란색/하늘색 펜 (미세한 파란 잉크 흔적까지 감지)
      const isBlueInk = (b > r + 4 && b > g + 3) || (b > 100 && (b - minC) > 5);
      // 빨간색/주황색 펜
      const isRedInk = (r > g + 7 && r > b + 7) || (r > 120 && (r - Math.max(g, b)) > 8);
      // 기타 색연필, 유색 잉크
      const isColoredInk = diff > 7 && maxC > 65 && maxC < 242;

      if (isBlueInk || isRedInk || isColoredInk) {
        if (isStaff) {
          // 오선보 선과 겹친 필기: 끊어지지 않도록 오선보 선 색상으로 복원!
          data[idx] = staffColor.r;
          data[idx + 1] = staffColor.g;
          data[idx + 2] = staffColor.b;
        } else {
          // 오선보 밖: 깨끗한 종이 배경색으로 치환
          data[idx] = bgR;
          data[idx + 1] = bgG;
          data[idx + 2] = bgB;
        }
        continue;
      }

      // 유색 잉크가 없는 흑백 필기 영역 처리:
      // 유색 필기가 아닌 경우에만 흑백 어두운 픽셀 제거 (단, 오선보 줄은 절대 제거하지 않음)
      if (!hasColoredHandwriting && !isStaff) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 210) {
          data[idx] = bgR;
          data[idx + 1] = bgG;
          data[idx + 2] = bgB;
        }
      }
    }
  }

  // 변경된 픽셀 캔버스에 재반영
  ctx.putImageData(imgData, bx, by);

  return canvas.toDataURL('image/png');
}
