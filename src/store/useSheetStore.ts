import { create } from 'zustand';
import { SheetMusicData, ChordItem, HighlightArea, TextBoxItem, AnnotationIconItem, ApiConfig } from '../types';
import { DEFAULT_API_CONFIG, analyzeSheetMusicWithAI, generateSessionGuidesWithAI } from '../services/aiService';
import { renderTransposedSheetMusic } from '../utils/canvasRenderer';
import { saveAppState, loadAppState } from '../services/storageService';
import { getContrastTextColor } from '../utils/colorUtils';

interface SheetStoreState {
  sheets: SheetMusicData[];
  activeSheetId: string | null;
  showHighlights: boolean;
  isSlideMode: boolean;
  slideIndex: number;
  isEditMode: boolean;
  theme: 'dark' | 'light';
  apiConfig: ApiConfig;

  // 알림 토스트 상태
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;

  // 영속성 및 자동 저장 상태
  isDirty: boolean;
  lastSavedAt: number | null;
  autoSaveMessage: string;
  isLoadedFromStorage: boolean;

  // Actions
  initFromStorage: () => Promise<boolean>;
  saveToStorage: () => Promise<void>;
  checkAndAutoSave: () => Promise<void>;

  addSheetsFromFiles: (files: File[]) => Promise<void>;
  addSampleSheet: () => Promise<void>;
  removeSheet: (id: string) => void;
  reorderSheets: (fromIndex: number, toIndex: number) => void;
  setActiveSheetId: (id: string) => void;
  updateSheetTitle: (sheetId: string, title: string) => Promise<void>;
  setSheetKey: (id: string, targetKey: string) => Promise<void>;
  analyzeSheet: (id: string, forceMock?: boolean) => Promise<void>;
  generateGuides: (id: string) => Promise<void>;
  toggleHighlights: () => Promise<void>;
  setEditMode: (mode: boolean) => void;
  
  // 코드 아이템 관리
  addChord: (sheetId: string, chord: Omit<ChordItem, 'id'>) => Promise<void>;
  updateChord: (sheetId: string, chordId: string, chordText: string) => Promise<void>;
  moveChord: (sheetId: string, chordId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  resizeChord: (sheetId: string, chordId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  removeChord: (sheetId: string, chordId: string) => Promise<void>;

  // 세션 가이드 하이라이트 관리
  addHighlight: (sheetId: string, hl: Omit<HighlightArea, 'id'>) => Promise<void>;
  updateHighlight: (sheetId: string, hlId: string, label: string, borderColor?: string, backgroundColor?: string) => Promise<void>;
  moveHighlight: (sheetId: string, hlId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  resizeHighlight: (sheetId: string, hlId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  removeHighlight: (sheetId: string, hlId: string) => Promise<void>;

  // 글상자 (Text Box) 관리
  addTextBox: (sheetId: string, item: Omit<TextBoxItem, 'id'>) => Promise<void>;
  updateTextBox: (sheetId: string, boxId: string, data: Partial<TextBoxItem>) => Promise<void>;
  moveTextBox: (sheetId: string, boxId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  resizeTextBox: (sheetId: string, boxId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  removeTextBox: (sheetId: string, boxId: string) => Promise<void>;

  // 악보 기호 아이콘 (|, ✓, (, )) 관리
  addAnnotation: (sheetId: string, item: Omit<AnnotationIconItem, 'id'>) => Promise<void>;
  updateAnnotation: (sheetId: string, annoId: string, data: Partial<AnnotationIconItem>) => Promise<void>;
  moveAnnotation: (sheetId: string, annoId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  resizeAnnotation: (sheetId: string, annoId: string, box: { x: number; y: number; width: number; height: number }) => Promise<void>;
  removeAnnotation: (sheetId: string, annoId: string) => Promise<void>;

  // 슬라이드 쇼 제어
  startSlideShow: (startIndex?: number) => void;
  exitSlideShow: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  setSlideIndex: (index: number) => void;

  // 설정 및 테마
  setTheme: (theme: 'dark' | 'light') => void;
  setApiConfig: (config: Partial<ApiConfig>) => void;
}

// 이미지 엘리먼트 캐시 (메모리 내 빠른 렌더링용)
const imageCache = new Map<string, HTMLImageElement>();

async function getOrLoadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function applyThemeToDOM(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.body.classList.remove('dark');
    document.body.classList.add('light');
  }
}

const initialTheme: 'dark' | 'light' = 
  (typeof window !== 'undefined' && (localStorage.getItem('praise_helper_theme') as 'dark' | 'light')) || 'light';
if (typeof document !== 'undefined') {
  applyThemeToDOM(initialTheme);
}

export const useSheetStore = create<SheetStoreState>((set, get) => ({
  sheets: [],
  activeSheetId: null,
  showHighlights: true,
  isSlideMode: false,
  slideIndex: 0,
  isEditMode: false,
  theme: initialTheme,
  apiConfig: DEFAULT_API_CONFIG,
  toastMessage: null,

  isDirty: false,
  lastSavedAt: null,
  autoSaveMessage: '자동 저장 준비됨',
  isLoadedFromStorage: false,

  initFromStorage: async () => {
    try {
      const saved = await loadAppState();
      if (saved && saved.sheets && saved.sheets.length > 0) {
        applyThemeToDOM(saved.theme || 'dark');
        set({
          sheets: saved.sheets,
          activeSheetId: saved.sheets[0]?.id || null,
          showHighlights: saved.showHighlights ?? true,
          theme: saved.theme || 'dark',
          apiConfig: saved.apiConfig || DEFAULT_API_CONFIG,
          lastSavedAt: saved.lastSavedAt || Date.now(),
          isDirty: false,
          autoSaveMessage: '이전 작업 내용 복원됨',
          isLoadedFromStorage: true,
        });

        // 저장된 악보들 캔버스 무손실 재렌더링
        for (const s of saved.sheets) {
          await reRenderSingleSheet(s.id, set, get);
        }
        return true;
      }
    } catch (e) {
      console.warn('Failed to restore from storage:', e);
    }
    set({ isLoadedFromStorage: true });
    return false;
  },

  saveToStorage: async () => {
    const { sheets, showHighlights, theme, apiConfig } = get();
    const now = Date.now();
    try {
      set({ autoSaveMessage: '저장 중...' });
      await saveAppState({
        sheets,
        showHighlights,
        theme,
        apiConfig,
        lastSavedAt: now,
      });
      const timeStr = new Date(now).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      set({
        isDirty: false,
        lastSavedAt: now,
        autoSaveMessage: `자동 저장 완료 (${timeStr})`,
      });
    } catch (err) {
      console.error('Save to storage error:', err);
      set({ autoSaveMessage: '저장 실패' });
    }
  },

  checkAndAutoSave: async () => {
    const { isDirty, sheets } = get();
    if (isDirty && sheets.length > 0) {
      console.log('[AutoSave] 1분 주기 변경사항 감지 -> 자동 저장 실행');
      await get().saveToStorage();
    }
  },

  setActiveSheetId: (id: string) => {
    set({ activeSheetId: id });
  },

  setEditMode: (mode: boolean) => {
    set({ isEditMode: mode });
  },

  updateSheetTitle: async (sheetId: string, title: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, title } : s)),
      isDirty: true,
    }));
    await get().saveToStorage();
  },

  setTheme: (theme: 'dark' | 'light') => {
    applyThemeToDOM(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('praise_helper_theme', theme);
    }
    set({ theme, isDirty: true });
    // 테마 변경 즉시 저장
    get().saveToStorage();
  },

  setApiConfig: (partial: Partial<ApiConfig>) => {
    set((state) => ({ 
      apiConfig: { ...state.apiConfig, ...partial },
      isDirty: true 
    }));
    get().saveToStorage();
  },

  toggleHighlights: async () => {
    const nextShow = !get().showHighlights;
    set({ showHighlights: nextShow, isDirty: true });
    const { sheets } = get();
    for (const s of sheets) {
      await reRenderSingleSheet(s.id, set, get);
    }
    get().saveToStorage();
  },

  addSheetsFromFiles: async (files: File[]) => {
    const newSheets: SheetMusicData[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await readFileAsDataURL(file);
      const img = await getOrLoadImage(dataUrl);

      const id = `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

      const sheet: SheetMusicData = {
        id,
        title: cleanTitle,
        fileName: file.name,
        originalImageUrl: dataUrl,
        transposedImageUrl: dataUrl,
        detectedKey: 'G',
        currentKey: 'G',
        chords: [],
        sessionHighlights: [],
        textBoxes: [],
        annotations: [],
        naturalWidth: img.naturalWidth || 1000,
        naturalHeight: img.naturalHeight || 1400,
        isAnalyzing: false,
      };

      newSheets.push(sheet);
    }

    if (newSheets.length === 0) return;

    set((state) => ({
      sheets: [...state.sheets, ...newSheets],
      activeSheetId: state.activeSheetId || newSheets[0].id,
      isDirty: true,
    }));
    await get().saveToStorage();
  },

  addSampleSheet: async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('꽃들도 (花も) - 찬양팀 콘티 예시', 600, 110);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Key: G Major   |   Tempo: 72   |   4/4 박자', 600, 160);

    const staffYList = [280, 560, 840, 1120];
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;

    for (const sy of staffYList) {
      for (let line = 0; line < 5; line++) {
        const ly = sy + line * 18;
        ctx.beginPath();
        ctx.moveTo(100, ly);
        ctx.lineTo(1100, ly);
        ctx.stroke();
      }
      for (let bar = 0; bar <= 4; bar++) {
        const bx = 100 + bar * 250;
        ctx.beginPath();
        ctx.moveTo(bx, sy);
        ctx.lineTo(bx, sy + 72);
        ctx.stroke();
      }
    }

    const sampleChords = [
      { text: 'G', x: 130, y: 250 },
      { text: 'D/F#', x: 380, y: 250 },
      { text: 'Em7', x: 630, y: 250 },
      { text: 'Bm7', x: 880, y: 250 },
      { text: 'C', x: 130, y: 530 },
      { text: 'G/B', x: 380, y: 530 },
      { text: 'Am7', x: 630, y: 530 },
      { text: 'D7', x: 880, y: 530 },
      { text: 'Em', x: 130, y: 810 },
      { text: 'Cadd9', x: 380, y: 810 },
      { text: 'G', x: 630, y: 810 },
      { text: 'D', x: 880, y: 810 },
      { text: 'C', x: 130, y: 1090 },
      { text: 'D', x: 380, y: 1090 },
      { text: 'G', x: 630, y: 1090 },
      { text: 'G', x: 880, y: 1090 },
    ];

    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    for (const c of sampleChords) {
      ctx.fillText(c.text, c.x, c.y);
    }

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('이 곳에 생명 샘 솟아나', 140, 395);
    ctx.fillText('눈물 골짝 지나갈 때에', 390, 395);
    ctx.fillText('머잖아 열매 맺히고', 640, 395);
    ctx.fillText('웃음 소리 넘쳐나리라', 890, 395);

    ctx.fillText('꽃들도 구름도 바람도', 140, 675);
    ctx.fillText('넓은 바다도 찬양하라', 390, 675);
    ctx.fillText('찬양하라 예수를', 640, 675);
    ctx.fillText('하늘을 울리며 노래해', 890, 675);

    const dataUrl = canvas.toDataURL('image/png');
    const img = await getOrLoadImage(dataUrl);

    const id = `sheet-sample-${Date.now()}`;
    const chords: ChordItem[] = sampleChords.map((c, i) => ({
      id: `sample-chord-${i}`,
      chordText: c.text,
      box: {
        x: c.x - 10,
        y: c.y - 32,
        width: 100,
        height: 42,
      },
    }));

    const sessionHighlights: HighlightArea[] = [
      {
        id: 'sample-hl-1',
        label: '🥁 드럼 in (소프트 림샷)',
        box: { x: 100, y: 470, width: 1000, height: 160 },
        color: '#f59e0b',
      },
      {
        id: 'sample-hl-2',
        label: '📈 빌드업 (베이스 & 패드 참여)',
        box: { x: 100, y: 750, width: 1000, height: 160 },
        color: '#8b5cf6',
      },
      {
        id: 'sample-hl-3',
        label: '⚡ 브레이크 (피아노 솔로)',
        box: { x: 600, y: 1030, width: 500, height: 160 },
        color: '#ef4444',
      },
    ];

    const sampleSheet: SheetMusicData = {
      id,
      title: '꽃들도 (G Major)',
      fileName: '꽃들도_예시악보.png',
      originalImageUrl: dataUrl,
      transposedImageUrl: dataUrl,
      detectedKey: 'G',
      currentKey: 'G',
      chords,
      sessionHighlights,
      naturalWidth: 1200,
      naturalHeight: 1700,
      isAnalyzing: false,
    };

    set((state) => ({
      sheets: [...state.sheets, sampleSheet],
      activeSheetId: state.activeSheetId || id,
      isDirty: true,
    }));

    await reRenderSingleSheet(id, set, get);
    await get().saveToStorage();
  },

  removeSheet: (id: string) => {
    set((state) => {
      const filtered = state.sheets.filter((s) => s.id !== id);
      const nextActiveId = state.activeSheetId === id ? (filtered[0]?.id || null) : state.activeSheetId;
      return {
        sheets: filtered,
        activeSheetId: nextActiveId,
        isDirty: true,
      };
    });
    get().saveToStorage();
  },

  reorderSheets: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const cloned = [...state.sheets];
      const [moved] = cloned.splice(fromIndex, 1);
      cloned.splice(toIndex, 0, moved);
      return { sheets: cloned, isDirty: true };
    });
    get().saveToStorage();
  },

  setSheetKey: async (id: string, targetKey: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === id ? { ...s, currentKey: targetKey } : s)),
      isDirty: true,
    }));
    await reRenderSingleSheet(id, set, get);
  },

  setToastMessage: (msg: string | null) => {
    set({ toastMessage: msg });
    if (msg) {
      setTimeout(() => {
        if (get().toastMessage === msg) {
          set({ toastMessage: null });
        }
      }, 4000);
    }
  },

  analyzeSheet: async (id: string, forceMock = false) => {
    const sheet = get().sheets.find((s) => s.id === id);
    if (!sheet) return;

    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === id ? { ...s, isAnalyzing: true } : s)),
    }));

    try {
      const config = { ...get().apiConfig, useMock: forceMock || get().apiConfig.useMock };
      const result = await analyzeSheetMusicWithAI(
        sheet.originalImageUrl,
        sheet.naturalWidth,
        sheet.naturalHeight,
        config
      );

      set((state) => ({
        sheets: state.sheets.map((s) =>
          s.id === id
            ? {
                ...s,
                detectedKey: result.detectedKey,
                currentKey: result.detectedKey,
                chords: result.chords,
                isAnalyzing: false,
              }
            : s
        ),
        isDirty: true,
      }));

      await reRenderSingleSheet(id, set, get);
      await get().saveToStorage();
      get().setToastMessage(`✨ 악보 분석 완료: ${result.chords.length}개 코드 추출 (원곡: ${result.detectedKey} Key)`);
    } catch (err) {
      console.error('Sheet analysis error:', err);
      set((state) => ({
        sheets: state.sheets.map((s) => (s.id === id ? { ...s, isAnalyzing: false } : s)),
      }));
      get().setToastMessage('⚠️ 악보 분석을 완료할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  },

  generateGuides: async (id: string) => {
    const sheet = get().sheets.find((s) => s.id === id);
    if (!sheet) return;

    set((state) => ({
      sheets: state.sheets.map((s) => (s.id === id ? { ...s, isAnalyzing: true } : s)),
    }));

    try {
      const guides = await generateSessionGuidesWithAI(
        sheet.originalImageUrl,
        sheet.naturalWidth,
        sheet.naturalHeight,
        get().apiConfig
      );

      set((state) => ({
        sheets: state.sheets.map((s) =>
          s.id === id
            ? {
                ...s,
                sessionHighlights: guides,
                isAnalyzing: false,
              }
            : s
        ),
        showHighlights: true,
        isDirty: true,
      }));

      await reRenderSingleSheet(id, set, get);
      await get().saveToStorage();
      get().setToastMessage(`🥁 AI 세션 가이드 생성 완료: ${guides.length}개 연주 구간 추가됨`);
    } catch (err) {
      console.error('Session guide generation error:', err);
      set((state) => ({
        sheets: state.sheets.map((s) => (s.id === id ? { ...s, isAnalyzing: false } : s)),
      }));
      get().setToastMessage('⚠️ 세션 가이드 생성 중 오류가 발생했습니다.');
    }
  },

  addChord: async (sheetId: string, chord: Omit<ChordItem, 'id'>) => {
    const newChordItem: ChordItem = {
      ...chord,
      id: `chord-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, chords: [...s.chords, newChordItem] } : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  updateChord: async (sheetId: string, chordId: string, chordText: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              chords: s.chords.map((c) => (c.id === chordId ? { ...c, chordText } : c)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  moveChord: async (sheetId: string, chordId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              chords: s.chords.map((c) => (c.id === chordId ? { ...c, box } : c)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  resizeChord: async (sheetId: string, chordId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              chords: s.chords.map((c) => (c.id === chordId ? { ...c, box } : c)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  removeChord: async (sheetId: string, chordId: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, chords: s.chords.filter((c) => c.id !== chordId) }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  addHighlight: async (sheetId: string, hl: Omit<HighlightArea, 'id'>) => {
    const borderColor = hl.borderColor || hl.color || '#3b82f6';
    const backgroundColor = hl.backgroundColor || 'rgba(59, 130, 246, 0.2)';
    const textColor = hl.textColor || getContrastTextColor(backgroundColor || borderColor);
    const newHl: HighlightArea = {
      ...hl,
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      borderColor,
      backgroundColor,
      textColor,
      color: borderColor,
    };
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, sessionHighlights: [...s.sessionHighlights, newHl] } : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  updateHighlight: async (sheetId: string, hlId: string, label: string, borderColor?: string, backgroundColor?: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              sessionHighlights: s.sessionHighlights.map((h) => {
                if (h.id !== hlId) return h;
                const nextBorder = borderColor || h.borderColor || h.color || '#3b82f6';
                const nextBg = backgroundColor || h.backgroundColor || 'rgba(59, 130, 246, 0.2)';
                const nextTextColor = getContrastTextColor(nextBg || nextBorder);
                return {
                  ...h,
                  label,
                  borderColor: nextBorder,
                  backgroundColor: nextBg,
                  textColor: nextTextColor,
                  color: nextBorder,
                };
              }),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  moveHighlight: async (sheetId: string, hlId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              sessionHighlights: s.sessionHighlights.map((h) =>
                h.id === hlId ? { ...h, box } : h
              ),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  resizeHighlight: async (sheetId: string, hlId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              sessionHighlights: s.sessionHighlights.map((h) =>
                h.id === hlId ? { ...h, box } : h
              ),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  removeHighlight: async (sheetId: string, hlId: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, sessionHighlights: s.sessionHighlights.filter((h) => h.id !== hlId) }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  // 글상자 (Text Box) 관리
  addTextBox: async (sheetId: string, item: Omit<TextBoxItem, 'id'>) => {
    const newBox: TextBoxItem = {
      ...item,
      id: `tb-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, textBoxes: [...(s.textBoxes || []), newBox] } : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  updateTextBox: async (sheetId: string, boxId: string, data: Partial<TextBoxItem>) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              textBoxes: (s.textBoxes || []).map((t) => (t.id === boxId ? { ...t, ...data } : t)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  moveTextBox: async (sheetId: string, boxId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              textBoxes: (s.textBoxes || []).map((t) => (t.id === boxId ? { ...t, box } : t)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  resizeTextBox: async (sheetId: string, boxId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              textBoxes: (s.textBoxes || []).map((t) => (t.id === boxId ? { ...t, box } : t)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  removeTextBox: async (sheetId: string, boxId: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, textBoxes: (s.textBoxes || []).filter((t) => t.id !== boxId) }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  // 악보 기호 아이콘 (|, ✓, (, )) 관리
  addAnnotation: async (sheetId: string, item: Omit<AnnotationIconItem, 'id'>) => {
    const newAnno: AnnotationIconItem = {
      ...item,
      id: `anno-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    };
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId ? { ...s, annotations: [...(s.annotations || []), newAnno] } : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  updateAnnotation: async (sheetId: string, annoId: string, data: Partial<AnnotationIconItem>) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              annotations: (s.annotations || []).map((a) => (a.id === annoId ? { ...a, ...data } : a)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  moveAnnotation: async (sheetId: string, annoId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              annotations: (s.annotations || []).map((a) => (a.id === annoId ? { ...a, box } : a)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  resizeAnnotation: async (sheetId: string, annoId: string, box: { x: number; y: number; width: number; height: number }) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? {
              ...s,
              annotations: (s.annotations || []).map((a) => (a.id === annoId ? { ...a, box } : a)),
            }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  removeAnnotation: async (sheetId: string, annoId: string) => {
    set((state) => ({
      sheets: state.sheets.map((s) =>
        s.id === sheetId
          ? { ...s, annotations: (s.annotations || []).filter((a) => a.id !== annoId) }
          : s
      ),
      isDirty: true,
    }));
    await reRenderSingleSheet(sheetId, set, get);
    await get().saveToStorage();
  },

  startSlideShow: (startIndex = 0) => {
    const { sheets, activeSheetId } = get();
    if (sheets.length === 0) return;

    let targetIdx = startIndex;
    if (activeSheetId) {
      const idx = sheets.findIndex((s) => s.id === activeSheetId);
      if (idx !== -1) targetIdx = idx;
    }

    set({ isSlideMode: true, slideIndex: targetIdx });
  },

  exitSlideShow: () => {
    set({ isSlideMode: false });
  },

  nextSlide: () => {
    const { slideIndex, sheets } = get();
    if (slideIndex < sheets.length - 1) {
      const nextIdx = slideIndex + 1;
      set({ slideIndex: nextIdx, activeSheetId: sheets[nextIdx].id });
    }
  },

  prevSlide: () => {
    const { slideIndex, sheets } = get();
    if (slideIndex > 0) {
      const prevIdx = slideIndex - 1;
      set({ slideIndex: prevIdx, activeSheetId: sheets[prevIdx].id });
    }
  },

  setSlideIndex: (index: number) => {
    const { sheets } = get();
    if (index >= 0 && index < sheets.length) {
      set({ slideIndex: index, activeSheetId: sheets[index].id });
    }
  },
}));

/**
 * 단일 악보 캔버스 무손실 재렌더링 헬퍼
 */
async function reRenderSingleSheet(sheetId: string, set: any, get: any) {
  const sheet = get().sheets.find((s: SheetMusicData) => s.id === sheetId);
  if (!sheet) return;

  try {
    const img = await getOrLoadImage(sheet.originalImageUrl);
    const transposedUrl = await renderTransposedSheetMusic({
      originalImage: img,
      chords: sheet.chords,
      fromKey: sheet.detectedKey,
      toKey: sheet.currentKey,
      sessionHighlights: sheet.sessionHighlights,
      textBoxes: sheet.textBoxes || [],
      annotations: sheet.annotations || [],
      showHighlights: get().showHighlights,
    });

    set((state: any) => ({
      sheets: state.sheets.map((s: SheetMusicData) =>
        s.id === sheetId ? { ...s, transposedImageUrl: transposedUrl } : s
      ),
    }));
  } catch (err) {
    console.error('Failed to re-render sheet canvas:', err);
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
