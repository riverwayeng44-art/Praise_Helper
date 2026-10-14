/**
 * 색상 밝기(Luminance) 기반 대비 텍스트 색상 자동 판별 유틸리티
 * - 밝은 배경 -> 어두운 검정 글씨 (#0f172a)
 * - 어두운 배경 -> 밝은 하얀 글씨 (#ffffff)
 */
export function getContrastTextColor(colorStr?: string): '#0f172a' | '#ffffff' {
  if (!colorStr) return '#0f172a';

  const rgb = parseColorToRgb(colorStr);
  if (!rgb) return '#0f172a';

  // 표준 광도 공식 (Rec. 601)
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;

  // 광도가 145 이상이면 밝은 색으로 간주하여 검은 글씨 반환
  return luminance >= 145 ? '#0f172a' : '#ffffff';
}

/**
 * HEX / RGB / RGBA 색상 문자열에서 R, G, B 추출
 */
export function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const c = color.trim().toLowerCase();

  // 1. HEX (#fff, #ffffff)
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // 2. RGB / RGBA
  const rgbMatch = c.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * 기본 테두리 색상으로부터 반투명 배경색 생성
 */
export function createTranslucentColor(hexOrRgb: string, alpha = 0.22): string {
  const rgb = parseColorToRgb(hexOrRgb);
  if (!rgb) return `rgba(59, 130, 246, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * 텍스트에서 이모지 및 특수 기호 제거 (순수 텍스트만 추출)
 */
export function removeEmoji(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]/gu, '')
    .trim();
}
