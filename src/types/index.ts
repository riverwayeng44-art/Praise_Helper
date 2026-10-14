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
  label: string; // 예: "드럼 in", "브레이크", "빌드업", "세션 Full"
  box: Box;
  color?: string; // 하위 호환성용 색상
  borderColor?: string;     // 사용자 지정 테두리 색상 (예: "#3b82f6")
  backgroundColor?: string; // 사용자 지정 배경 색상 (예: "rgba(59, 130, 246, 0.2)")
  textColor?: string;       // 배경 밝기에 따라 자동 지정된 텍스트 색상 ("#0f172a" 또는 "#ffffff")
}

// 2. 글상자 (Text Box) 아이템
export interface TextBoxItem {
  id: string;
  text: string;
  box: Box;
  fontSize?: number;
  color?: string;           // 글자 색상 (예: "#2563eb", "#0f172a", "#ef4444")
  backgroundColor?: string; // 박스 배경색 (기본 투명 또는 흰색 반투명)
}

// 3. 악보 기호 아이콘 (Annotation Icons: |, ✓, (, ))
export type AnnotationType = 'bar' | 'check' | 'paren_open' | 'paren_close';

export interface AnnotationIconItem {
  id: string;
  iconType: AnnotationType; // '|', '✓', '(', ')'
  box: Box;
  color?: string;           // 기호 색상 (예: "#ef4444", "#2563eb", "#0f172a")
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
  textBoxes?: TextBoxItem[];
  annotations?: AnnotationIconItem[];
  naturalWidth: number;
  naturalHeight: number;
  isAnalyzing?: boolean;
  notes?: string;
}

export interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  model: string;
  useMock: boolean;
}
