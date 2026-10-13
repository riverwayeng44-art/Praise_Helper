export interface Box {
  x: number;      // 픽셀 또는 0~1 정규화 좌표
  y: number;
  width: number;
  height: number;
}

export interface ChordItem {
  id: string;
  chordText: string; // 예: "F#m7", "A/C#"
  box: Box;
}

export interface HighlightArea {
  id: string;
  label: string; // 예: "드럼 in", "브레이크", "빌드업", "세션 Full", "Acoustic"
  box: Box;
  color?: string; // 하이라이트 색상 (예: #f59e0b, #ef4444, #3b82f6)
}

export interface SheetMusicData {
  id: string;
  title: string;
  fileName: string;
  originalImageUrl: string;
  transposedImageUrl: string | null;
  detectedKey: string; // 원본 감지 키 (예: "G", "A", "C")
  currentKey: string;  // 전조 적용 키
  chords: ChordItem[];
  sessionHighlights: HighlightArea[];
  naturalWidth: number;
  naturalHeight: number;
  isAnalyzing?: boolean;
  notes?: string; // 찬양 인도자용 메모
}

export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  model: string;
  useMock: boolean;
}
