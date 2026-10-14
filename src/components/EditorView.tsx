import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowLeftRight, 
  Download, 
  RotateCcw, 
  Hash, 
  Bookmark, 
  Music, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  X,
  Edit2,
  Trash2,
  Move,
  ListFilter,
  Check,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';
import { STANDARD_KEYS, getSemitoneDiff, extractRootNote, transposeChord, FLAT_DOMINANT_KEYS } from '../utils/transposer';
import { AddChordModal } from './AddChordModal';
import { AddHighlightModal } from './AddHighlightModal';
import { ChordItem, HighlightArea } from '../types';

export const EditorView: React.FC = () => {
  const { 
    sheets, 
    activeSheetId, 
    setSheetKey, 
    analyzeSheet, 
    generateGuides,
    addChord, 
    updateChord,
    moveChord,
    resizeChord,
    removeChord,
    addHighlight, 
    updateHighlight,
    moveHighlight,
    resizeHighlight,
    removeHighlight,
    startSlideShow, 
    addSampleSheet,
    showHighlights,
    toggleHighlights,
    toastMessage,
    setToastMessage
  } = useSheetStore();

  const activeSheet = sheets.find((s) => s.id === activeSheetId);

  // 모달 상태
  const [isChordModalOpen, setIsChordModalOpen] = useState(false);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 선택된 요소 (코드 또는 하이라이트)
  const [selectedChordId, setSelectedChordId] = useState<string | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  // 인라인 수정 모달 상태
  const [editingChord, setEditingChord] = useState<{ id: string; text: string } | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<{ id: string; label: string } | null>(null);

  // 우측 요소 관리 패널 열림 여부
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chords' | 'highlights'>('chords');

  // 줌 레벨
  const [zoom, setZoom] = useState(1);

  // 신규 드래그 영역 선택 상태
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 요소 드래그 이동 상태 (60fps 로컬 오버레이 추적)
  const [dragState, setDragState] = useState<{
    type: 'chord' | 'highlight';
    id: string;
    startX: number;
    startY: number;
    origBox: { x: number; y: number; width: number; height: number };
    currentBox: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // 요소 크기 조절 (Resize) 상태 (60fps 로컬 오버레이 추적)
  const [resizeState, setResizeState] = useState<{
    type: 'chord' | 'highlight';
    id: string;
    handle: string; // 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
    startX: number;
    startY: number;
    origBox: { x: number; y: number; width: number; height: number };
    currentBox: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 악보 변경 시 상태 초기화
  useEffect(() => {
    setZoom(1);
    setSelectionBox(null);
    setCurrentBox(null);
    setSelectedChordId(null);
    setSelectedHighlightId(null);
    setIsSelecting(false);
    setDragState(null);
    setResizeState(null);
  }, [activeSheetId]);

  // F11 전체화면 & ESC 취소 & Delete/Backspace 키보드 삭제 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 중일 때는 Delete/Backspace 등 기본 동작 유지
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'F11') {
        e.preventDefault();
        const api = (window as any).electronAPI;
        if (api && api.toggleFullscreen) {
          api.toggleFullscreen();
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      } else if (e.key === 'Escape') {
        setSelectionBox(null);
        setCurrentBox(null);
        setSelectedChordId(null);
        setSelectedHighlightId(null);
        setIsSelecting(false);
        setDragState(null);
        setResizeState(null);
      } else if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (activeSheet) {
          if (selectedChordId) {
            e.preventDefault();
            removeChord(activeSheet.id, selectedChordId);
            setSelectedChordId(null);
          } else if (selectedHighlightId) {
            e.preventDefault();
            removeHighlight(activeSheet.id, selectedHighlightId);
            setSelectedHighlightId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSheet, selectedChordId, selectedHighlightId, removeChord, removeHighlight]);

  if (!activeSheet) {
    return (
      <main className="flex-1 h-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-8 select-none transition-colors duration-200">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
            <Music className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">선택된 악보가 없습니다</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            좌측 큐에서 악보를 선택하거나, 새로운 악보 이미지를 업로드하세요.
            찬양팀을 위한 무손실 키 변경과 세션 가이드가 자동으로 적용됩니다.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => addSampleSheet()}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
            >
              예시 찬양 악보 불러오기
            </button>
          </div>
        </div>
      </main>
    );
  }

  const semiDiff = getSemitoneDiff(activeSheet.detectedKey, activeSheet.currentKey);
  const preferFlat = FLAT_DOMINANT_KEYS.has(activeSheet.currentKey);

  const handleShiftSemitone = (delta: number) => {
    const currentRoot = extractRootNote(activeSheet.currentKey);
    const currentIndex = STANDARD_KEYS.indexOf(currentRoot);
    if (currentIndex === -1) return;
    const nextIndex = ((currentIndex + delta) % 12 + 12) % 12;
    setSheetKey(activeSheet.id, STANDARD_KEYS[nextIndex]);
  };

  const handleExportPng = () => {
    const downloadUrl = activeSheet.transposedImageUrl || activeSheet.originalImageUrl;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `[${activeSheet.currentKey}Key]_${activeSheet.title}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 마우스 다운: 악보 배경 드래그 선택 또는 요소 선택 해제
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    if (e.button !== 0) return;

    // 만약 요소를 잡고 드래그 중이거나 리사이즈 중인 경우는 무시
    if (dragState || resizeState) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const scaleX = (activeSheet.naturalWidth / rect.width) * zoom;
    const scaleY = (activeSheet.naturalHeight / rect.height) * zoom;

    setSelectionBox(null);
    setCurrentBox(null);
    setSelectedChordId(null);
    setSelectedHighlightId(null);

    setIsSelecting(true);
    setStartPos({ x: x * scaleX, y: y * scaleY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = (activeSheet.naturalWidth / rect.width) * zoom;
    const scaleY = (activeSheet.naturalHeight / rect.height) * zoom;

    // 1. 요소 크기 조절 (Resize) 중인 경우 - 로컬 60fps 추적
    if (resizeState) {
      const deltaX = (e.clientX - resizeState.startX) * scaleX;
      const deltaY = (e.clientY - resizeState.startY) * scaleY;
      const orig = resizeState.origBox;

      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;

      const handle = resizeState.handle;
      if (handle.includes('e')) {
        newW = Math.max(30, orig.width + deltaX);
      }
      if (handle.includes('s')) {
        newH = Math.max(20, orig.height + deltaY);
      }
      if (handle.includes('w')) {
        const potentialW = orig.width - deltaX;
        if (potentialW >= 30) {
          newX = orig.x + deltaX;
          newW = potentialW;
        }
      }
      if (handle.includes('n')) {
        const potentialH = orig.height - deltaY;
        if (potentialH >= 20) {
          newY = orig.y + deltaY;
          newH = potentialH;
        }
      }

      setResizeState({
        ...resizeState,
        currentBox: { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) },
      });
      return;
    }

    // 2. 요소 드래그 이동 중인 경우 - 로컬 60fps 추적
    if (dragState) {
      const deltaX = (e.clientX - dragState.startX) * scaleX;
      const deltaY = (e.clientY - dragState.startY) * scaleY;

      const newX = Math.max(0, Math.min(activeSheet.naturalWidth - dragState.origBox.width, Math.round(dragState.origBox.x + deltaX)));
      const newY = Math.max(0, Math.min(activeSheet.naturalHeight - dragState.origBox.height, Math.round(dragState.origBox.y + deltaY)));

      setDragState({
        ...dragState,
        currentBox: {
          ...dragState.origBox,
          x: newX,
          y: newY,
        },
      });
      return;
    }

    // 3. 신규 영역 드래그 선택 중인 경우
    if (isSelecting && startPos) {
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      const curX = x * scaleX;
      const curY = y * scaleY;

      const bx = Math.min(startPos.x, curX);
      const by = Math.min(startPos.y, curY);
      const bw = Math.abs(curX - startPos.x);
      const bh = Math.abs(curY - startPos.y);

      setCurrentBox({ x: bx, y: by, width: bw, height: bh });
    }
  };

  const handleCanvasMouseUp = () => {
    // 1. 리사이즈 완료 시점에만 스토어 업데이트 (단 1회 Canvas 갱신 및 DB 저장)
    if (resizeState) {
      const { type, id, currentBox } = resizeState;
      if (type === 'chord') {
        resizeChord(activeSheet.id, id, currentBox);
      } else {
        resizeHighlight(activeSheet.id, id, currentBox);
      }
      setResizeState(null);
      return;
    }

    // 2. 드래그 이동 완료 시점에만 스토어 업데이트 (단 1회 Canvas 갱신 및 DB 저장)
    if (dragState) {
      const { type, id, currentBox } = dragState;
      if (type === 'chord') {
        moveChord(activeSheet.id, id, currentBox);
      } else {
        moveHighlight(activeSheet.id, id, currentBox);
      }
      setDragState(null);
      return;
    }

    // 3. 신규 선택 영역 확정
    if (isSelecting) {
      if (currentBox && currentBox.width > 25 && currentBox.height > 18) {
        setSelectionBox(currentBox);
      } else {
        setSelectionBox(null);
      }
    }
    setIsSelecting(false);
    setCurrentBox(null);
  };

  // 요소 드래그 시작 핸들러
  const handleItemDragStart = (
    e: React.MouseEvent,
    type: 'chord' | 'highlight',
    id: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (type === 'chord') {
      setSelectedChordId(id);
      setSelectedHighlightId(null);
    } else {
      setSelectedHighlightId(id);
      setSelectedChordId(null);
    }

    setDragState({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origBox: { ...box },
      currentBox: { ...box },
    });
  };

  // 요소 리사이즈 핸들 드래그 시작 핸들러
  const handleResizeStart = (
    e: React.MouseEvent,
    type: 'chord' | 'highlight',
    id: string,
    handle: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setResizeState({
      type,
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origBox: { ...box },
      currentBox: { ...box },
    });
  };

  // PowerPoint 스타일 리사이즈 핸들 렌더링 헬퍼
  const renderResizeHandles = (
    type: 'chord' | 'highlight',
    id: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    const handleClass = "absolute w-2.5 h-2.5 bg-white border border-slate-900 rounded-sm shadow-md z-40";
    return (
      <>
        {/* 모서리 핸들 4개 */}
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'nw', box)}
          className={`${handleClass} -top-1.5 -left-1.5 cursor-nwse-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'ne', box)}
          className={`${handleClass} -top-1.5 -right-1.5 cursor-nesw-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'se', box)}
          className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'sw', box)}
          className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`}
        />
        {/* 변 핸들 4개 */}
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'n', box)}
          className={`${handleClass} -top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 's', box)}
          className={`${handleClass} -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'w', box)}
          className={`${handleClass} top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize`}
        />
        <div
          onMouseDown={(e) => handleResizeStart(e, type, id, 'e', box)}
          className={`${handleClass} top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize`}
        />
      </>
    );
  };

  const activeSheetIndex = sheets.findIndex((s) => s.id === activeSheetId);

  return (
    <main className="flex-1 h-full bg-slate-100 dark:bg-slate-950 flex flex-col min-w-0 select-none overflow-hidden transition-colors duration-200 relative">
      {/* 실시간 알림 토스트 팝업 */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-slate-700/80 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top duration-200">
          <span className="text-xs font-bold">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-0.5 text-slate-400 hover:text-white rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. 상단 메인 툴바 */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5 transition-colors duration-200 shadow-sm z-20">
        {/* 상단 1행 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs shadow-sm">
              {activeSheetIndex !== -1 ? `${activeSheetIndex + 1}번곡` : '악보'}
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
              {activeSheet.title}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
              원곡: {activeSheet.detectedKey} Key
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold">
              연주: {activeSheet.currentKey} Key
            </span>
            {semiDiff !== 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono font-bold">
                {semiDiff > 0 ? `+${semiDiff}` : semiDiff} 반음 전조
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 세션 가이드 표시 ON / OFF 토글 버튼 */}
            <button
              onClick={() => toggleHighlights()}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold border transition-all ${
                showHighlights
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-200'
              }`}
              title="악보 위 세션 가이드 하이라이트 표시 켜기/끄기"
            >
              {showHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>세션 가이드 {showHighlights ? 'ON' : 'OFF'}</span>
            </button>

            {/* AI 악보 코드 전수 분석 버튼 */}
            <button
              onClick={() => analyzeSheet(activeSheet.id)}
              disabled={activeSheet.isAnalyzing}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold border transition-all ${
                activeSheet.isAnalyzing
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500'
              }`}
              title={`${activeSheet.title}의 모든 코드를 정밀 분석하여 원터치 키 체인지를 활성화합니다`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeSheet.isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{activeSheet.isAnalyzing ? '분석 중...' : `AI 코드 전수 분석 (${activeSheetIndex + 1}번곡)`}</span>
            </button>

            {/* AI 자동 가이드 생성 버튼 (신규 분리 기능) */}
            <button
              onClick={() => generateGuides(activeSheet.id)}
              disabled={activeSheet.isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 transition-all hover:border-amber-500"
              title="악보의 연주 흐름(드럼 in, 브레이크, 빌드업 등)을 분석하여 세션 가이드만 생성합니다"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>AI 자동 가이드 생성</span>
            </button>

            {/* 수동 코드 추가 */}
            <button
              onClick={() => {
                setSelectionBox(null);
                setIsChordModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
              title="원하는 코드를 직접 추가합니다 (추가 후 마우스로 자유롭게 이동 가능)"
            >
              <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>+ 코드 추가</span>
            </button>

            {/* 수동 가이드 추가 */}
            <button
              onClick={() => {
                setSelectionBox(null);
                setIsHighlightModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
              title="세션 연주 가이드(드럼 in, 브레이크 등)를 추가합니다"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>+ 가이드 추가</span>
            </button>

            {/* 요소 관리 패널 토글 */}
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
                isSidePanelOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="현재 악보의 코드 및 세션 가이드 목록을 열고 수정/삭제합니다"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>요소 목록 ({activeSheet.chords.length}코드)</span>
            </button>

            {/* 무손실 내보내기 */}
            <button
              onClick={handleExportPng}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              title="무손실 고화질 악보 이미지로 저장"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>무손실 저장</span>
            </button>

            {/* 풀스크린 슬라이드 쇼 */}
            <button
              onClick={() => startSlideShow()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>PPT 슬라이드 (F11)</span>
            </button>
          </div>
        </div>

        {/* 상단 2행: 12 Key Selector */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>원터치 키 체인지:</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {STANDARD_KEYS.map((k) => {
              const isSelected = activeSheet.currentKey === k;
              const isOriginal = activeSheet.detectedKey === k;

              return (
                <button
                  key={k}
                  onClick={() => setSheetKey(activeSheet.id, k)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all relative ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  {k}
                  {isOriginal && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white dark:border-slate-900" title="원곡 키" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => handleShiftSemitone(-1)}
              className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold"
              title="-1 반음 (♭)"
            >
              -1♭
            </button>
            <button
              onClick={() => handleShiftSemitone(1)}
              className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold"
              title="+1 반음 (♯)"
            >
              +1♯
            </button>
            {semiDiff !== 0 && (
              <button
                onClick={() => setSheetKey(activeSheet.id, activeSheet.detectedKey)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium"
                title="원곡 키로 되돌리기"
              >
                <RotateCcw className="w-3 h-3" />
                <span>원키</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 메인 워크스페이스 (중앙 캔버스 + 우측 요소 관리 패널) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 캔버스 스크롤 컨테이너 (하단 잘림 없이 맨 끝까지 온전히 스크롤 가능) */}
        <div 
          ref={containerRef}
          onMouseDown={(e) => {
            if (e.target === containerRef.current) {
              setSelectionBox(null);
              setCurrentBox(null);
              setSelectedChordId(null);
              setSelectedHighlightId(null);
            }
          }}
          className="flex-1 overflow-auto bg-slate-100 dark:bg-zinc-950 p-6 flex flex-col items-center justify-start transition-colors duration-200"
        >
          {/* 악보 이미지 및 대화형 오버레이 레이어 */}
          <div 
            className="relative shadow-2xl rounded-lg border border-slate-300 dark:border-zinc-800 bg-white transition-transform duration-100 origin-top mb-12"
            style={{ 
              transform: `scale(${zoom})`,
              width: 'fit-content',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
          >
            {/* 100% 해상도 무손실 악보 이미지 */}
            <img
              ref={imageRef}
              src={activeSheet.transposedImageUrl || activeSheet.originalImageUrl}
              alt={activeSheet.title}
              className="block max-w-full h-auto object-contain select-none pointer-events-none"
              draggable={false}
            />

            {/* 대화형 인터랙티브 코드 박스 레이어 (클릭, 드래그 이동, 리사이즈, 수정, 삭제) */}
            {activeSheet.chords.map((chord) => {
              // 현재 실시간 이동 중이거나 리사이즈 중인 경우 로컬 실시간 박스 우선 적용 (60fps)
              let activeBox = chord.box;
              if (dragState && dragState.type === 'chord' && dragState.id === chord.id) {
                activeBox = dragState.currentBox;
              } else if (resizeState && resizeState.type === 'chord' && resizeState.id === chord.id) {
                activeBox = resizeState.currentBox;
              }

              const bx = activeBox.x <= 1 ? activeBox.x * activeSheet.naturalWidth : activeBox.x;
              const by = activeBox.y <= 1 ? activeBox.y * activeSheet.naturalHeight : activeBox.y;
              const bw = activeBox.width <= 1 ? activeBox.width * activeSheet.naturalWidth : activeBox.width;
              const bh = activeBox.height <= 1 ? activeBox.height * activeSheet.naturalHeight : activeBox.height;

              const isSelected = selectedChordId === chord.id;
              const displayChord = semiDiff !== 0 
                ? transposeChord(chord.chordText, semiDiff, preferFlat)
                : chord.chordText;

              return (
                <div
                  key={chord.id}
                  onMouseDown={(e) => handleItemDragStart(e, 'chord', chord.id, { x: bx, y: by, width: bw, height: bh })}
                  className={`absolute cursor-move select-none group transition-shadow ${
                    isSelected
                      ? 'border-2 border-emerald-500 bg-emerald-500/20 z-30 shadow-lg ring-2 ring-emerald-400/40 rounded'
                      : 'hover:border-2 hover:border-emerald-400 hover:bg-emerald-400/10 z-10 rounded'
                  }`}
                  style={{
                    left: `${(bx / activeSheet.naturalWidth) * 100}%`,
                    top: `${(by / activeSheet.naturalHeight) * 100}%`,
                    width: `${(bw / activeSheet.naturalWidth) * 100}%`,
                    height: `${(bh / activeSheet.naturalHeight) * 100}%`,
                  }}
                  title={`코드: ${displayChord} (드래그 이동 / 핸들 크기조절 / Delete키 삭제)`}
                >
                  {/* PowerPoint 스타일 리사이즈 핸들 */}
                  {isSelected && renderResizeHandles('chord', chord.id, { x: bx, y: by, width: bw, height: bh })}

                  {/* 선택 시 미니 액션 툴바 */}
                  {isSelected && (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute -top-8 left-0 z-50 bg-slate-900 text-white rounded-lg px-2 py-1 text-xs shadow-2xl flex items-center gap-1.5 border border-slate-700 whitespace-nowrap"
                    >
                      <span className="font-bold font-mono text-emerald-400">{displayChord}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChord({ id: chord.id, text: chord.chordText });
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                        title="코드 수정"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeChord(activeSheet.id, chord.id);
                          setSelectedChordId(null);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                        title="코드 삭제 (Delete)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChordId(null);
                        }}
                        className="p-0.5 text-slate-500 hover:text-slate-300"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 대화형 인터랙티브 세션 가이드 레이어 (클릭, 드래그 이동, 리사이즈, 수정, 삭제) */}
            {activeSheet.sessionHighlights.map((hl) => {
              // 현재 실시간 이동 중이거나 리사이즈 중인 경우 로컬 실시간 박스 우선 적용 (60fps)
              let activeBox = hl.box;
              if (dragState && dragState.type === 'highlight' && dragState.id === hl.id) {
                activeBox = dragState.currentBox;
              } else if (resizeState && resizeState.type === 'highlight' && resizeState.id === hl.id) {
                activeBox = resizeState.currentBox;
              }

              const hx = activeBox.x <= 1 ? activeBox.x * activeSheet.naturalWidth : activeBox.x;
              const hy = activeBox.y <= 1 ? activeBox.y * activeSheet.naturalHeight : activeBox.y;
              const hw = activeBox.width <= 1 ? activeBox.width * activeSheet.naturalWidth : activeBox.width;
              const hh = activeBox.height <= 1 ? activeBox.height * activeSheet.naturalHeight : activeBox.height;

              const isSelected = selectedHighlightId === hl.id;

              return (
                <div
                  key={hl.id}
                  onMouseDown={(e) => handleItemDragStart(e, 'highlight', hl.id, { x: hx, y: hy, width: hw, height: hh })}
                  className={`absolute cursor-move select-none transition-shadow ${
                    isSelected
                      ? 'border-2 border-amber-500 ring-2 ring-amber-400/40 z-30 rounded-lg shadow-lg'
                      : 'hover:border-2 hover:border-amber-400/60 z-10 rounded-lg'
                  }`}
                  style={{
                    left: `${(hx / activeSheet.naturalWidth) * 100}%`,
                    top: `${(hy / activeSheet.naturalHeight) * 100}%`,
                    width: `${(hw / activeSheet.naturalWidth) * 100}%`,
                    height: `${(hh / activeSheet.naturalHeight) * 100}%`,
                  }}
                  title={`세션 가이드: ${hl.label} (드래그 이동 / 핸들 크기조절 / Delete키 삭제)`}
                >
                  {/* PowerPoint 스타일 리사이즈 핸들 */}
                  {isSelected && renderResizeHandles('highlight', hl.id, { x: hx, y: hy, width: hw, height: hh })}

                  {/* 선택 시 미니 액션 툴바 */}
                  {isSelected && (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute -top-9 left-2 z-50 bg-slate-900 text-white rounded-lg px-2.5 py-1 text-xs shadow-2xl flex items-center gap-2 border border-slate-700 whitespace-nowrap"
                    >
                      <span className="font-bold text-amber-400">{hl.label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingHighlight({ id: hl.id, label: hl.label });
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                        title="가이드 라벨 수정"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHighlight(activeSheet.id, hl.id);
                          setSelectedHighlightId(null);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                        title="가이드 삭제 (Delete)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHighlightId(null);
                        }}
                        className="p-0.5 text-slate-500 hover:text-slate-300"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 마우스 드래그 중인 임시 박스 시각화 */}
            {currentBox && isSelecting && imageRef.current && (
              <div
                className="absolute border-2 border-dashed border-emerald-400 bg-emerald-400/20 pointer-events-none z-20"
                style={{
                  left: `${(currentBox.x / activeSheet.naturalWidth) * 100}%`,
                  top: `${(currentBox.y / activeSheet.naturalHeight) * 100}%`,
                  width: `${(currentBox.width / activeSheet.naturalWidth) * 100}%`,
                  height: `${(currentBox.height / activeSheet.naturalHeight) * 100}%`,
                }}
              />
            )}

            {/* 드래그 완료 후 생성된 선택 영역 박스 및 툴팁 팝업 */}
            {selectionBox && !isSelecting && imageRef.current && (
              <>
                <div
                  className="absolute border-2 border-emerald-400 bg-emerald-400/20 pointer-events-none z-20 rounded shadow-md ring-2 ring-emerald-500/30"
                  style={{
                    left: `${(selectionBox.x / activeSheet.naturalWidth) * 100}%`,
                    top: `${(selectionBox.y / activeSheet.naturalHeight) * 100}%`,
                    width: `${(selectionBox.width / activeSheet.naturalWidth) * 100}%`,
                    height: `${(selectionBox.height / activeSheet.naturalHeight) * 100}%`,
                  }}
                />

                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 shadow-2xl flex items-center gap-1.5 select-none"
                  style={{
                    left: `${Math.max(2, Math.min(80, (selectionBox.x / activeSheet.naturalWidth) * 100))}%`,
                    top: `${Math.max(5, (selectionBox.y / activeSheet.naturalHeight) * 100)}%`,
                    transform: 'translateY(-115%)',
                  }}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsChordModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors shadow-sm flex items-center gap-1"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>이 영역에 코드 지정</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHighlightModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-sm flex items-center gap-1"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>세션 가이드 지정</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionBox(null);
                      setCurrentBox(null);
                    }}
                    className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="선택 취소 (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 플로팅 줌 컨트롤 바 */}
        <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 p-1.5 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl backdrop-blur-md">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 px-1">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-[11px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            100%
          </button>
        </div>

        {/* 3. 우측 "코드 & 세션 가이드 목록 관리 패널" */}
        {isSidePanelOpen && (
          <aside className="w-80 h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                악보 요소 관리
              </h3>
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 탭 전환 */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950/40">
              <button
                onClick={() => setActiveTab('chords')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === 'chords'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                코드 ({activeSheet.chords.length})
              </button>
              <button
                onClick={() => setActiveTab('highlights')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === 'highlights'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                가이드 ({activeSheet.sessionHighlights.length})
              </button>
            </div>

            {/* 탭 내용 리스트 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === 'chords' ? (
                activeSheet.chords.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">등록된 코드가 없습니다.</p>
                ) : (
                  activeSheet.chords.map((chord, idx) => {
                    const displayChord = semiDiff !== 0 
                      ? transposeChord(chord.chordText, semiDiff, preferFlat)
                      : chord.chordText;

                    return (
                      <div
                        key={chord.id}
                        onClick={() => setSelectedChordId(chord.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          selectedChordId === chord.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {displayChord}
                          </span>
                          {semiDiff !== 0 && (
                            <span className="text-[10px] text-slate-400">
                              (원곡: {chord.chordText})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChord({ id: chord.id, text: chord.chordText });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                            title="코드 수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeChord(activeSheet.id, chord.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                            title="코드 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                activeSheet.sessionHighlights.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">등록된 세션 가이드가 없습니다.</p>
                ) : (
                  activeSheet.sessionHighlights.map((hl) => (
                    <div
                      key={hl.id}
                      onClick={() => setSelectedHighlightId(hl.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedHighlightId === hl.id
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: hl.color || '#f59e0b' }} 
                        />
                        <span className="font-bold text-slate-900 dark:text-white">
                          {hl.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingHighlight({ id: hl.id, label: hl.label });
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="가이드 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHighlight(activeSheet.id, hl.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="가이드 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 text-center">
              💡 악보 위에서 요소를 마우스로 직접 끌어서 위치를 이동시킬 수도 있습니다.
            </div>
          </aside>
        )}
      </div>

      {/* 인라인 코드 수정 모달 */}
      {editingChord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">코드 텍스트 수정</h3>
            <input
              type="text"
              value={editingChord.text}
              onChange={(e) => setEditingChord({ ...editingChord, text: e.target.value })}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold mb-4 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingChord(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingChord.text.trim()) {
                    updateChord(activeSheet.id, editingChord.id, editingChord.text.trim());
                  }
                  setEditingChord(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인라인 가이드 수정 모달 */}
      {editingHighlight && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">세션 가이드 라벨 수정</h3>
            <input
              type="text"
              value={editingHighlight.label}
              onChange={(e) => setEditingHighlight({ ...editingHighlight, label: e.target.value })}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold mb-4 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingHighlight(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingHighlight.label.trim()) {
                    updateHighlight(activeSheet.id, editingHighlight.id, editingHighlight.label.trim());
                  }
                  setEditingHighlight(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 등록 모달들 */}
      <AddChordModal
        isOpen={isChordModalOpen}
        onClose={() => {
          setIsChordModalOpen(false);
          setSelectionBox(null);
        }}
        initialBox={selectionBox || { 
          x: Math.round(activeSheet.naturalWidth * 0.15), 
          y: Math.round(activeSheet.naturalHeight * 0.2), 
          width: Math.round(activeSheet.naturalWidth * 0.08), 
          height: 35 
        }}
        onAddChord={(chord) => addChord(activeSheet.id, chord)}
      />

      <AddHighlightModal
        isOpen={isHighlightModalOpen}
        onClose={() => {
          setIsHighlightModalOpen(false);
          setSelectionBox(null);
        }}
        initialBox={selectionBox || { 
          x: Math.round(activeSheet.naturalWidth * 0.1), 
          y: Math.round(activeSheet.naturalHeight * 0.3), 
          width: Math.round(activeSheet.naturalWidth * 0.8), 
          height: 90 
        }}
        onAddHighlight={(hl) => addHighlight(activeSheet.id, hl)}
      />
    </main>
  );
};
