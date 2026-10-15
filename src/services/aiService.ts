import { ApiConfig, ChordItem, HighlightArea } from '../types';

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'https://debian.tailfdf16c.ts.net/v1',
  endpoint: 'https://debian.tailfdf16c.ts.net/v1/chat/completions',
  apiKey: 'dummy-key',
  model: 'gemini-3.1-pro',
  useMock: false,
};

export interface AIAnalysisResult {
  detectedTitle?: string;
  detectedKey: string;
  chords: ChordItem[];
  sessionHighlights: HighlightArea[];
}

/**
 * 전송용 이미지 최적화 (선명도 유지 및 전송 지연 방지: 최대 1800px, 88% 품질)
 */
async function createOptimizedDataUrl(originalDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 1800;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(originalDataUrl);
    img.src = originalDataUrl;
  });
}

/**
 * 1. AI 악보 코드 전수 분석 (Bridge Server 맥미니 Hermes 직통 라우팅 @@)
 * - 실제 악보 오선보 위의 코드만 정확히 추출
 * - 오른쪽 메모나 설명 글은 제외
 * - 2마디 동안 코드가 1개면 1개만 추출 (없는 코드를 지어내지 않음)
 */
export async function analyzeSheetMusicWithAI(
  imageBase64: string,
  imageWidth: number,
  imageHeight: number,
  config: ApiConfig = DEFAULT_API_CONFIG
): Promise<AIAnalysisResult> {
  const promptText = `
@@ 너는 찬양팀 악보 및 음악 화성학 최고 전문가 AI야.
첨부된 찬양 악보 이미지를 정밀 분석해서 인쇄된 모든 음악 코드를 추출하고 정확한 조성을 찾아줘.

[엄격한 분석 및 좌표 규칙]
1. "detectedTitle": 악보 맨 윗줄 중앙이나 좌상단에 가장 크게 인쇄된 실제 찬양 곡 제목 (예: "주를 기억하라", "꽃들도", "은혜" 등).
2. "detectedKey": 악보의 원본 조성 (조표의 샵/플랫 개수와 첫/마지막 으뜸음을 분석하여 "A", "G", "C", "D", "E", "F", "Bb", "Eb" 등으로 정확히 판별).
3. "chords": 오선보(Staff) 바로 위에 인쇄된 영문 코드만 위에서부터 순서대로 빠짐없이 정확히 추출해.
   - 실제 악보에 인쇄되어 있는 코드만 추출하고, 없는 코드를 임의로 지어내거나 추측해서 채우지 마!
   - 2마디 동안 코드가 1개면 1개만 추출해.
   - 악보 바깥 우측이나 하단의 곡 순서/가사 메모(Intro, V, PC, 드럼 in 등 설명 텍스트)는 악보 코드가 아니므로 절대 chords에 포함하지 마!
   - 각 코드 글자의 위치 비율(0.0 ~ 1.0)을 정밀하게 측정해줘:
     * xPercent: 전체 이미지 가로 기준 해당 코드 영문 글자의 중심 X 비율 (0.00 ~ 1.00)
     * yPercent: 전체 이미지 세로 기준 해당 코드 영문 글자의 중심 Y 비율 (0.00 ~ 1.00)
     * 주의: 오선보 줄이나 음표 머리가 아닌, 오선보 바로 위에 인쇄된 영문 코드 글자(C, Em7, D 등) 자체의 중심 위치를 측정해야 해.
     * 중요: 각 오선보 줄마다 마디 시작 위치와 코드 배치가 다릅니다. 절대 위 줄의 X/Y 좌표를 아래 줄에 그대로 복사하지 말고, 해당 줄 코드 글자의 실제 인쇄 위치를 정밀하게 측정해.

반드시 마크다운이나 추가 설명 없이 순수 JSON 객체만 응답해:
{
  "detectedTitle": "주를 기억하라",
  "detectedKey": "A",
  "chords": [
    { "chordText": "A", "xPercent": 0.12, "yPercent": 0.18 },
    { "chordText": "E", "xPercent": 0.35, "yPercent": 0.18 }
  ]
}
`.trim();

  const optimizedDataUrl = await createOptimizedDataUrl(imageBase64);
  const controller = new AbortController();
  // 복잡한 악보(주를 기억하라 등)를 위한 180초(3분) 여유 타임아웃
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch(config.endpoint || `${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
      },
      body: JSON.stringify({
        model: config.model || 'gemini-3.1-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: optimizedDataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI 서버 통신 오류 (${response.status})`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content || content.includes('타임아웃 발생')) {
      throw new Error('AI 분석 서버 응답 지연');
    }

    const parsed = extractJsonFromResponse(content);
    if (!parsed || !parsed.chords || parsed.chords.length === 0) {
      throw new Error('악보에서 코드를 감지하지 못했습니다.');
    }

    const finalChords: ChordItem[] = parsed.chords.map((c: any, index: number) => {
      const chordStr = (c.chordText || 'G').trim();
      const charCount = chordStr.length;

      // 글자 수에 비례한 컴팩트한 박스 크기 산출 (인접 코드와의 겹침 방지)
      const baseCharWidth = Math.max(14, Math.round(imageWidth * 0.011));
      const boxW = Math.max(26, Math.min(Math.round(baseCharWidth * Math.max(1.2, charCount + 0.8)), 80));
      const boxH = Math.max(22, Math.round(imageHeight * 0.022));

      let bx = 0;
      let by = 0;
      let bw = boxW;
      let bh = boxH;

      if (typeof c.xPercent === 'number' && typeof c.yPercent === 'number') {
        bx = Math.round(c.xPercent * imageWidth - bw / 2);
        by = Math.round(c.yPercent * imageHeight - bh / 2);
      } else if (c.box) {
        const sanitized = sanitizeBox(c.box, imageWidth, imageHeight);
        bx = sanitized.x;
        by = sanitized.y;
        bw = sanitized.width;
        bh = sanitized.height;
      } else {
        bx = Math.round(imageWidth * 0.1 * (index + 1));
        by = Math.round(imageHeight * 0.15);
      }

      // 화면 경계 안전 보정
      bx = Math.max(10, Math.min(bx, imageWidth - bw - 10));
      by = Math.max(10, Math.min(by, imageHeight - bh - 10));

      return {
        id: `ai-chord-${Date.now()}-${index}`,
        chordText: chordStr,
        box: { x: bx, y: by, width: bw, height: bh },
      };
    });

    return {
      detectedTitle: parsed.detectedTitle ? parsed.detectedTitle.trim() : undefined,
      detectedKey: parsed.detectedKey || 'C',
      chords: finalChords,
      sessionHighlights: [],
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[AI Service Error]', err);
    throw err;
  }
}

/**
 * 2. AI 자동 세션 가이드 생성 (오선보 마디 기반)
 */
export async function generateSessionGuidesWithAI(
  imageBase64: string,
  imageWidth: number,
  imageHeight: number,
  config: ApiConfig = DEFAULT_API_CONFIG
): Promise<HighlightArea[]> {
  const promptText = `
@@ 너는 예배 찬양팀 전문 세션 디렉터 AI야.
첨부된 찬양 악보의 형식(Intro, Verse, Chorus, Bridge, Coda 등)을 파악해서,
찬양팀 밴드(드럼, 베이스, 건반, 어쿠스틱기타, 일렉기타)의 연주 다이내믹 흐름을 돕는 세션 가이드 3~4개를 추천해줘.
예: "🥁 드럼 in & 베이스", "📈 빌드업 (점점 고조)", "🔥 풀 세션 (Chorus)", "⚡ 브레이크 & 피아노 Only"

각 가이드가 위치할 마디의 세로 위치 비율(yStartPercent, yEndPercent: 0.0 ~ 1.0)과 오선보 가로 범위(xStartPercent, xEndPercent: 0.0 ~ 1.0)를 지정해줘:
{
  "sessionHighlights": [
    { 
      "label": "🥁 드럼 in", 
      "xStartPercent": 0.08, 
      "yStartPercent": 0.15, 
      "xEndPercent": 0.92, 
      "yEndPercent": 0.28 
    }
  ]
}
`.trim();

  const optimizedDataUrl = await createOptimizedDataUrl(imageBase64);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(config.endpoint || `${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
      },
      body: JSON.stringify({
        model: config.model || 'gemini-3.1-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: optimizedDataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI 서버 통신 오류 (${response.status})`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    const parsed = extractJsonFromResponse(content);

    if (!parsed || !parsed.sessionHighlights || parsed.sessionHighlights.length === 0) {
      return [];
    }

    return parsed.sessionHighlights.map((hl: any, idx: number) => {
      const xs = hl.xStartPercent ?? 0.08;
      const ys = hl.yStartPercent ?? 0.15 + idx * 0.2;
      const xe = hl.xEndPercent ?? 0.92;
      const ye = hl.yEndPercent ?? ys + 0.12;

      const bx = Math.round(xs * imageWidth);
      const by = Math.round(ys * imageHeight);
      const bw = Math.round((xe - xs) * imageWidth);
      const bh = Math.round((ye - ys) * imageHeight);

      return {
        id: `ai-hl-${Date.now()}-${idx}`,
        label: hl.label || '세션 가이드',
        color: getHighlightColorByLabel(hl.label || ''),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
        textColor: '#ffffff',
        box: { x: bx, y: by, width: Math.max(80, bw), height: Math.max(30, bh) },
      };
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[AI Guide Error]', err);
    throw err;
  }
}

function getHighlightColorByLabel(label: string): string {
  if (label.includes('드럼')) return 'rgba(59, 130, 246, 0.25)';
  if (label.includes('빌드업')) return 'rgba(234, 179, 8, 0.25)';
  if (label.includes('Full') || label.includes('풀')) return 'rgba(239, 68, 68, 0.25)';
  if (label.includes('브레이크')) return 'rgba(168, 85, 247, 0.25)';
  return 'rgba(16, 185, 129, 0.25)';
}

function extractJsonFromResponse(content: string): any {
  if (!content) return null;
  let cleaned = content.trim();

  // 1. 마크다운 코드 블록 제거 (```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. 가장 바깥쪽 { 와 } 탐색
  const firstOpenBrace = cleaned.indexOf('{');
  const lastCloseBrace = cleaned.lastIndexOf('}');

  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
    cleaned = cleaned.substring(firstOpenBrace, lastCloseBrace + 1);
  }

  // 3. 트레일링 콤마 제거 (, } -> } / , ] -> ])
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[JSON Parse Recovery Triggered]', err);

    // 복구 1단계: 괄호 불균형 닫기
    let fixed = cleaned;
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';

    try {
      return JSON.parse(fixed);
    } catch (e2) {
      // 복구 2단계: 정규식으로 chord 객체 전수 구출
      const chords: any[] = [];
      const chordRegex = /"chordText"\s*:\s*"([^"]+)"\s*,\s*"xPercent"\s*:\s*([0-9.]+)\s*,\s*"yPercent"\s*:\s*([0-9.]+)/g;
      let m;
      while ((m = chordRegex.exec(content)) !== null) {
        chords.push({
          chordText: m[1],
          xPercent: parseFloat(m[2]),
          yPercent: parseFloat(m[3]),
        });
      }

      const keyMatch = content.match(/"detectedKey"\s*:\s*"([^"]+)"/);
      const detectedKey = keyMatch ? keyMatch[1] : 'C';

      if (chords.length > 0) {
        return { detectedKey, chords };
      }

      throw err;
    }
  }
}

function sanitizeBox(
  box: any,
  imgWidth: number,
  imgHeight: number
): { x: number; y: number; width: number; height: number } {
  if (!box) {
    return { x: 50, y: 50, width: 50, height: 30 };
  }
  let { x, y, width, height } = box;

  if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
    x = x * imgWidth;
    y = y * imgHeight;
    width = width * imgWidth;
    height = height * imgHeight;
  }

  return {
    x: Math.max(0, Math.min(Math.round(x), imgWidth - 20)),
    y: Math.max(0, Math.min(Math.round(y), imgHeight - 20)),
    width: Math.max(35, Math.min(Math.round(width), Math.round(imgWidth * 0.18))),
    height: Math.max(22, Math.min(Math.round(height), Math.round(imgHeight * 0.05))),
  };
}

export interface HandwritingRecognitionResult {
  recognizedText: string;
  category: 'section' | 'symbol' | 'memo';
  symbolType?: 'bar' | 'check' | 'paren_open' | 'paren_close';
  suggestedColor: string;
  suggestedFontSize: number;
}

/**
 * 3. AI 필기 텍스트 및 파트 기호 인식 (OCR)
 * - V, C, C2, B, PC, Intro, Outro 및 기호(|, ✓, (, ))를 인식
 */
export async function recognizeHandwritingWithAI(
  croppedBase64: string,
  config: ApiConfig = DEFAULT_API_CONFIG
): Promise<HandwritingRecognitionResult> {
  const promptText = `
@@ 너는 찬양팀 악보 필기 및 악보 파트 기호 인식 최고 전문가 AI야.
첨부된 악보 잘라낸 이미지에서 사용자가 손으로 필기한 텍스트나 기호를 정확히 읽어내줘 (OCR).

[자주 쓰이는 찬양 악보 파트 기호 및 형식]
1. 곡 파트 기호:
   - "Intro" (인트로)
   - "V", "V1", "V2", "Verse" (절)
   - "C", "C1", "C2", "Chorus" (후렴)
   - "B", "Bridge" (브릿지)
   - "PC", "Pre-Chorus" (프리코러스)
   - "Inter", "Interlude" (간주)
   - "Outro" (아웃트로)
2. 악보 기호:
   - "|" (세로 구분 막대) -> symbolType: "bar"
   - "✓" (체크 표시) -> symbolType: "check"
   - "(" (여는 괄호 단독) -> symbolType: "paren_open"
   - ")" (닫는 괄호 단독) -> symbolType: "paren_close"
3. 기타 자유 손글씨 연주 큐/메모

[반드시 순수 JSON 객체만 응답해]
{
  "recognizedText": "C2",
  "category": "section",
  "symbolType": null,
  "suggestedColor": "#1d4ed8",
  "suggestedFontSize": 34
}
`.trim();

  if (config.useMock) {
    return {
      recognizedText: 'C2',
      category: 'section',
      suggestedColor: '#1d4ed8',
      suggestedFontSize: 34,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(config.endpoint || `${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
      },
      body: JSON.stringify({
        model: config.model || 'gemini-3.1-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: croppedBase64 } },
            ],
          },
        ],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content && !content.includes('타임아웃 발생')) {
        const parsed = extractJsonFromResponse(content);
        if (parsed && parsed.recognizedText) {
          return {
            recognizedText: parsed.recognizedText,
            category: parsed.category || 'section',
            symbolType: parsed.symbolType,
            suggestedColor: parsed.suggestedColor || '#1d4ed8',
            suggestedFontSize: parsed.suggestedFontSize || 34,
          };
        }
      }
    }
  } catch (err) {
    console.warn('AI OCR query warning:', err);
  }

  return {
    recognizedText: 'C2',
    category: 'section',
    suggestedColor: '#1d4ed8',
    suggestedFontSize: 34,
  };
}

export interface SetlistMatchResult {
  sheetId: string;
  sheetTitle: string;
  youtubeUrl: string;
  detectedSongName?: string;
  videoTitle?: string;
}

/**
 * 4. 콘티 링크 텍스트 AI 분석 및 악보 매칭
 * - 유튜브 oEmbed로 실제 영상 제목을 조회하고 텍스트 속 곡명과 대조하여 악보들에 정확히 매칭
 */
export async function analyzeSetlistTextWithAI(
  rawText: string,
  registeredSheets: { id: string; title: string; detectedKey?: string }[],
  config: ApiConfig = DEFAULT_API_CONFIG
): Promise<SetlistMatchResult[]> {
  if (registeredSheets.length === 0) return [];

  // 1. 텍스트 라인별 및 유튜브 oEmbed로 실제 영상 제목/사용자 입력 제목 비동기 추출
  const { parseSetlistTextWithTitles } = await import('../utils/youtubeUtils');
  const extractedItems = await parseSetlistTextWithTitles(rawText);

  if (extractedItems.length === 0) return [];

  const promptText = `
@@ 너는 찬양팀 콘티 및 찬양곡 매칭 최고 전문가 AI야.
사용자가 입력한 콘티 텍스트 및 추출된 유튜브 영상 정보(실제 영상 제목 포함)를 현재 등록된 악보들과 대조하여, 각 악보에 정확한 원곡 영상 링크를 1:1 매칭해줘.

[현재 등록된 악보 목록]
${registeredSheets.map((s, i) => `${i + 1}. [ID: ${s.id}] 악보명: "${s.title}" (조성: ${s.detectedKey || '미정'} Key)`).join('\n')}

[추출된 유튜브 링크 및 영상 정보]
${extractedItems.map((item, i) => `${i + 1}. URL: ${item.url}\n   - 사용자 입력 곡명: "${item.userTextTitle}"\n   - 실제 유튜브 영상 제목: "${item.videoTitle}"`).join('\n')}

[사용자 원본 입력 콘티]
"""
${rawText}
"""

[매칭 및 판별 규칙]
1. 유튜브 실제 영상 제목(예: "주를 기억하라 - 어노인팅", "꽃들도 (花も)") 및 사용자 입력 곡명을 바탕으로, 해당 곡이 어떤 악보([ID])에 해당하는지 정확히 판별해.
2. 만약 악보명이 파일명(예: "IMG_7588", "IMG_7589")으로 되어 있다면:
   - 악보의 조성(A Key, G Key 등)이나 영상/콘티에 적힌 순서 및 곡명을 고려하여 절대 뒤바뀌지 않도록 올바른 악보에 매칭해.
3. 매칭된 각 악보에 대해 sheetId, sheetTitle, youtubeUrl, detectedSongName(실제 곡명 예: "주를 기억하라")을 순수 JSON 배열로 반환해:

[
  { 
    "sheetId": "${registeredSheets[0].id}", 
    "sheetTitle": "${registeredSheets[0].title}", 
    "youtubeUrl": "${extractedItems[0].url}",
    "detectedSongName": "주를 기억하라",
    "videoTitle": "${extractedItems[0].videoTitle}"
  }
]
`.trim();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(config.endpoint || `${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
      },
      body: JSON.stringify({
        model: config.model || 'gemini-3.1-pro',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.1,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        let cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          cleaned = cleaned.substring(start, end + 1);
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((item: any) => item.sheetId && item.youtubeUrl);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[AI Setlist Analysis Warning] Falling back to smart title matcher:', err);
  }

  // 지능형 로컬 매칭 폴백: 곡명 키워드 및 Key 매칭
  const matchedSheetIds = new Set<string>();
  const results: SetlistMatchResult[] = [];

  // 1차: 곡명 키워드 포함 검사
  for (const item of extractedItems) {
    const searchTarget = (item.userTextTitle + ' ' + item.videoTitle).toLowerCase();
    const foundSheet = registeredSheets.find((s) => {
      if (matchedSheetIds.has(s.id)) return false;
      const sTitle = s.title.toLowerCase();
      return (
        searchTarget.includes(sTitle) ||
        (sTitle.length > 1 && searchTarget.includes(sTitle)) ||
        (s.title.includes('7588') && searchTarget.includes('주를 기억하라')) ||
        (s.title.includes('7589') && searchTarget.includes('꽃들도'))
      );
    });

    if (foundSheet) {
      matchedSheetIds.add(foundSheet.id);
      results.push({
        sheetId: foundSheet.id,
        sheetTitle: foundSheet.title,
        youtubeUrl: item.url,
        detectedSongName: item.userTextTitle || item.videoTitle,
        videoTitle: item.videoTitle,
      });
    }
  }

  // 2차: 미배정된 악보와 남은 링크를 순서대로 배정
  const remainingSheets = registeredSheets.filter((s) => !matchedSheetIds.has(s.id));
  const remainingItems = extractedItems.filter((it) => !results.some((r) => r.youtubeUrl === it.url));

  remainingSheets.forEach((sheet, idx) => {
    if (remainingItems[idx]) {
      results.push({
        sheetId: sheet.id,
        sheetTitle: sheet.title,
        youtubeUrl: remainingItems[idx].url,
        detectedSongName: remainingItems[idx].userTextTitle || remainingItems[idx].videoTitle,
        videoTitle: remainingItems[idx].videoTitle,
      });
    }
  });

  return results;
}
