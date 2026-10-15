import { ApiConfig, ChordItem, HighlightArea } from '../types';

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'https://debian.tailfdf16c.ts.net/v1',
  endpoint: 'https://debian.tailfdf16c.ts.net/v1/chat/completions',
  apiKey: 'dummy-key',
  model: 'gemini-3.5-flash',
  useMock: false,
};

export interface AIAnalysisResult {
  detectedKey: string;
  chords: ChordItem[];
  sessionHighlights: HighlightArea[];
}

/**
 * 로컬 개발 환경(localhost)일 경우 Vite 프록시(/bridge-api)로 자동 라우팅하여 CORS 회피
 */
function resolveEndpoint(endpoint: string): string {
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && endpoint.includes('debian.tailfdf16c.ts.net')) {
      return endpoint.replace('https://debian.tailfdf16c.ts.net', '/bridge-api');
    }
  }
  return endpoint;
}

/**
 * Google Gemini 공식 REST API 키 여부 확인
 */
function isGoogleGeminiKeyOrEndpoint(config: ApiConfig): boolean {
  if (config.apiKey && config.apiKey.startsWith('AIza')) return true;
  if (config.endpoint && config.endpoint.includes('generativelanguage.googleapis.com')) return true;
  return false;
}

/**
 * 전송용 이미지 최적화 (글자 및 오선 선명도 극대화: 최대 2200px, 95% 품질)
 */
async function createOptimizedDataUrl(originalDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 2200;
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
      resolve(canvas.toDataURL('image/jpeg', 0.95));
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
  // 1. 스마트 시뮬레이션 모드 활성화 시 오프라인 모의 분석
  if (config.useMock) {
    return generateSimulatedAnalysis(imageWidth, imageHeight);
  }

  const promptText = `
@@ 너는 찬양팀 악보 및 음악 화성학 최고 전문가 AI야.
첨부된 찬양 악보 이미지를 정밀 분석해서 인쇄된 모든 음악 코드를 추출하고 정확한 조성을 찾아줘.

[엄격한 분석 및 좌표 규칙]
1. "detectedKey": 악보의 원본 조성 (조표의 샵/플랫 개수와 첫/마지막 으뜸음을 분석하여 "A", "G", "C", "D", "E", "F", "Bb", "Eb" 등으로 정확히 판별).
2. "chords": 오선보(Staff) 바로 위에 인쇄된 영문 코드만 위에서부터 순서대로 정확히 추출해.
   - 실제 악보에 인쇄되어 있는 코드만 추출하고, 없는 코드를 임의로 지어내거나 추측해서 채우지 마!
   - 2마디 동안 코드가 1개면 1개만 추출해.
   - 악보 바깥 우측이나 하단의 곡 순서/가사 메모(Intro, V, PC, 드럼 in 등 설명 텍스트)는 악보 코드가 아니므로 절대 chords에 포함하지 마!
   - 각 코드 글자의 위치 비율(0.0 ~ 1.0)을 측정해줘:
     * xPercent: 전체 이미지 가로 기준 해당 코드 글자의 중심 X 비율 (0.00 ~ 1.00)
     * yPercent: 전체 이미지 세로 기준 해당 코드 글자의 중심 Y 비율 (0.00 ~ 1.00)

반드시 순수 JSON 객체만 응답해:
{
  "detectedKey": "A",
  "chords": [
    { "chordText": "A", "xPercent": 0.12, "yPercent": 0.18 },
    { "chordText": "E", "xPercent": 0.35, "yPercent": 0.18 }
  ]
}
`.trim();

  const optimizedDataUrl = await createOptimizedDataUrl(imageBase64);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    let content = '';

    if (isGoogleGeminiKeyOrEndpoint(config)) {
      // Direct Google Gemini API 통신 (웹 브라우저 CORS 완벽 지원)
      const model = config.model?.startsWith('gemini') ? config.model : 'gemini-2.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
      const base64Data = optimizedDataUrl.split(',')[1] || optimizedDataUrl;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`Google Gemini API 오류 (${response.status}): ${errJson.error?.message || response.statusText}`);
      }

      const json = await response.json();
      content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Bridge Server (OpenAI 호환 API)
      const targetEndpoint = resolveEndpoint(config.endpoint || `${config.baseUrl}/chat/completions`);
      const requestModel = config.model === 'gemini-3.1-pro' ? 'gemini-3.5-flash' : (config.model || 'gemini-3.5-flash');
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
        },
        body: JSON.stringify({
          model: requestModel,
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
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI 서버 통신 오류 (${response.status})`);
      }

      const json = await response.json();
      content = json.choices?.[0]?.message?.content || '';
    }

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
      detectedKey: parsed.detectedKey || 'C',
      chords: finalChords,
      sessionHighlights: [],
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[AI Service Error]', err);

    if (err.name === 'AbortError') {
      throw new Error('AI 분석 서버 응답 시간이 초과되었습니다 (3분 타임아웃).');
    }
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error('AI 분석 서버 통신 오류: 네트워크 연결 상태를 확인해주세요.');
    }
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
  if (config.useMock) {
    return generateSimulatedGuides(imageWidth, imageHeight);
  }

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
      "xStartPercent": 0.05, 
      "xEndPercent": 0.65, 
      "yStartPercent": 0.15, 
      "yEndPercent": 0.23 
    }
  ]
}
`.trim();

  const optimizedDataUrl = await createOptimizedDataUrl(imageBase64);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    let content = '';

    if (isGoogleGeminiKeyOrEndpoint(config)) {
      const model = config.model?.startsWith('gemini') ? config.model : 'gemini-2.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
      const base64Data = optimizedDataUrl.split(',')[1] || optimizedDataUrl;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`Google Gemini API 오류 (${response.status}): ${errJson.error?.message || response.statusText}`);
      }

      const json = await response.json();
      content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const targetEndpoint = resolveEndpoint(config.endpoint || `${config.baseUrl}/chat/completions`);
      const requestModel = config.model === 'gemini-3.1-pro' ? 'gemini-3.5-flash' : (config.model || 'gemini-3.5-flash');
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey || 'dummy-key'}`,
        },
        body: JSON.stringify({
          model: requestModel,
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
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI 서버 오류 (${response.status})`);
      }

      const json = await response.json();
      content = json.choices?.[0]?.message?.content || '';
    }

    if (!content || content.includes('타임아웃 발생')) {
      throw new Error('AI 가이드 생성 서버 응답 지연');
    }

    const parsed = extractJsonFromResponse(content);
    if (!parsed || !parsed.sessionHighlights || parsed.sessionHighlights.length === 0) {
      throw new Error('생성된 가이드가 없습니다.');
    }

    return parsed.sessionHighlights.map((h: any, index: number) => {
      let x = Math.round((h.xStartPercent ?? 0.05) * imageWidth);
      let y = Math.round((h.yStartPercent ?? (0.15 + index * 0.18)) * imageHeight);
      let w = Math.round(((h.xEndPercent ?? 0.65) - (h.xStartPercent ?? 0.05)) * imageWidth);
      let hgt = Math.round(((h.yEndPercent ?? (h.yStartPercent + 0.08)) - (h.yStartPercent ?? 0.15)) * imageHeight);

      w = Math.max(100, Math.min(w, imageWidth - x));
      hgt = Math.max(35, Math.min(hgt, Math.round(imageHeight * 0.12)));

      return {
        id: `ai-hl-${Date.now()}-${index}`,
        label: h.label || '세션 가이드',
        color: getHighlightColorByLabel(h.label),
        box: { x, y, width: w, height: hgt },
      };
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[AI Guide Error]', err);

    if (err.name === 'AbortError') {
      throw new Error('AI 가이드 생성 서버 응답 시간이 초과되었습니다 (3분 타임아웃).');
    }
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error('AI 분석 서버 통신 오류: 네트워크 연결 상태를 확인해주세요.');
    }
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
  let cleaned = content.trim();

  // Hermes 서명 (--- ⚕️ Hermes ...) 및 마크다운 코드블록 제거
  const firstOpenBrace = cleaned.indexOf('{');
  const lastCloseBrace = cleaned.lastIndexOf('}');

  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
    cleaned = cleaned.substring(firstOpenBrace, lastCloseBrace + 1);
  }

  return JSON.parse(cleaned);
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

/**
 * 스마트 시뮬레이션 모의 분석 헬퍼 (오프라인 / 데모 전용)
 */
function generateSimulatedAnalysis(imageWidth: number, imageHeight: number): AIAnalysisResult {
  const sampleChords = [
    { chordText: 'G', xPercent: 0.12, yPercent: 0.18 },
    { chordText: 'D/F#', xPercent: 0.35, yPercent: 0.18 },
    { chordText: 'Em7', xPercent: 0.58, yPercent: 0.18 },
    { chordText: 'Cadd9', xPercent: 0.80, yPercent: 0.18 },
    { chordText: 'G/B', xPercent: 0.12, yPercent: 0.36 },
    { chordText: 'Am7', xPercent: 0.35, yPercent: 0.36 },
    { chordText: 'Dsus4', xPercent: 0.58, yPercent: 0.36 },
    { chordText: 'G', xPercent: 0.80, yPercent: 0.36 },
  ];

  const chords: ChordItem[] = sampleChords.map((c, i) => {
    const baseW = Math.max(14, Math.round(imageWidth * 0.011));
    const bw = Math.max(26, Math.min(Math.round(baseW * Math.max(1.2, c.chordText.length + 0.8)), 80));
    const bh = Math.max(22, Math.round(imageHeight * 0.022));
    const bx = Math.round(c.xPercent * imageWidth - bw / 2);
    const by = Math.round(c.yPercent * imageHeight - bh / 2);

    return {
      id: `sim-chord-${Date.now()}-${i}`,
      chordText: c.chordText,
      box: { x: bx, y: by, width: bw, height: bh },
    };
  });

  return {
    detectedKey: 'G',
    chords,
    sessionHighlights: [],
  };
}

function generateSimulatedGuides(imageWidth: number, imageHeight: number): HighlightArea[] {
  return [
    {
      id: `sim-hl-${Date.now()}-1`,
      label: '🥁 드럼 in & 베이스',
      color: 'rgba(59, 130, 246, 0.25)',
      box: {
        x: Math.round(imageWidth * 0.05),
        y: Math.round(imageHeight * 0.15),
        width: Math.round(imageWidth * 0.45),
        height: Math.round(imageHeight * 0.08),
      },
    },
    {
      id: `sim-hl-${Date.now()}-2`,
      label: '🔥 풀 세션 (Chorus)',
      color: 'rgba(239, 68, 68, 0.25)',
      box: {
        x: Math.round(imageWidth * 0.05),
        y: Math.round(imageHeight * 0.52),
        width: Math.round(imageWidth * 0.90),
        height: Math.round(imageHeight * 0.08),
      },
    },
  ];
}
