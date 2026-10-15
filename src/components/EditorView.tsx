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
  X, 
  Edit2, 
  Trash2, 
  ListFilter, 
  Check, 
  Eye, 
  EyeOff,
  Type,
  Stamp,
  Palette,
  CheckCircle2,
  Youtube
} from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';
import { STANDARD_KEYS, getSemitoneDiff, extractRootNote, transposeChord, FLAT_DOMINANT_KEYS } from '../utils/transposer';
import { AddChordModal } from './AddChordModal';
import { AddHighlightModal } from './AddHighlightModal';
import { AddTextBoxModal, FONT_OPTIONS } from './AddTextBoxModal';
import { AddAnnotationModal } from './AddAnnotationModal';
import { AiAutoFixModal } from './AiAutoFixModal';
import { cropImageSnippet } from '../utils/imageCleaner';
import { ChordItem, HighlightArea, TextBoxItem, AnnotationIconItem, AnnotationType } from '../types';

export const EditorView: React.FC = () => {
  const { 
    sheets, 
    activeSheetId, 
    setSheetKey, 
    analyzeSheet, 
    updateSheetTitle,
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
    addTextBox,
    updateTextBox,
    moveTextBox,
    resizeTextBox,
    removeTextBox,
    addAnnotation,
    updateAnnotation,
    moveAnnotation,
    resizeAnnotation,
    removeAnnotation,
    showHighlights,
    toggleHighlights,
    toastMessage,
    setToastMessage,
    isEditMode,
    setEditMode,
    openVideoPlayer
  } = useSheetStore();

  const activeSheet = sheets.find((s) => s.id === activeSheetId);

  // 인라인 제목 편집 상태 (NotebookLM 스타일)
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // 모달 상태
  const [isChordModalOpen, setIsChordModalOpen] = useState(false);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [isTextBoxModalOpen, setIsTextBoxModalOpen] = useState(false);
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);

  // AI 자동 수정 모드 & 모달 상태
  const [isAiAutoFixMode, setIsAiAutoFixMode] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTargetBox, setAiTargetBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [aiSnippetUrl, setAiSnippetUrl] = useState<string>('');
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 선택 영역 드래그 박스 (신규 추가용)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 선택된 요소 ID
  const [selectedChordId, setSelectedChordId] = useState<string | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // 모달 수정 대상 아이템
  const [editingChord, setEditingChord] = useState<{ id: string; text: string } | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<HighlightArea | null>(null);
  const [editingTextBox, setEditingTextBox] = useState<TextBoxItem | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<AnnotationIconItem | null>(null);

  // 우측 요소 관리 패널 열림 여부 및 활성 탭
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chords' | 'highlights' | 'textBoxes' | 'annotations'>('chords');

  // 줌 레벨
  const [zoom, setZoom] = useState(1);

  // 신규 드래그 영역 선택 상태
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 요소 드래그 이동 상태 (60fps 로컬 오버레이 추적)
  const [dragState, setDragState] = useState<{
    type: 'chord' | 'highlight' | 'textBox' | 'annotation';
    id: string;
    startX: number;
    startY: number;
    origBox: { x: number; y: number; width: number; height: number };
    currentBox: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // 요소 크기 조절 (Resize) 상태 (60fps 로컬 오버레이 추적)
  const [resizeState, setResizeState] = useState<{
    type: 'chord' | 'highlight' | 'textBox' | 'annotation';
    id: string;
    handle: string;
    startX: number;
    startY: number;
    origBox: { x: number; y: number; width: number; height: number };
    currentBox: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []);

  // 악보 변경 시 상태 초기화
  useEffect(() => {
    setZoom(1);
    setSelectionBox(null);
    setCurrentBox(null);
    setSelectedChordId(null);
    setSelectedHighlightId(null);
    setSelectedTextBoxId(null);
    setSelectedAnnotationId(null);
    setIsSelecting(false);
    setDragState(null);
    setResizeState(null);
    setIsAiAutoFixMode(false);
    setIsAiModalOpen(false);
    setAiTargetBox(null);
    setAiSnippetUrl('');
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (activeSheet) {
      setTitleInput(activeSheet.title);
      setIsEditingTitle(false);
    }
  }, [activeSheetId]);

  // F11 전체화면 & ESC 취소 & Delete/Backspace 키보드 삭제 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        setIsAiAutoFixMode(false);
        setIsAiModalOpen(false);
        setAiTargetBox(null);
        setSelectionBox(null);
        setCurrentBox(null);
        setSelectedChordId(null);
        setSelectedHighlightId(null);
        setSelectedTextBoxId(null);
        setSelectedAnnotationId(null);
        setIsSelecting(false);
        setDragState(null);
        setResizeState(null);
        setIsEditingTitle(false);
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
          } else if (selectedTextBoxId) {
            e.preventDefault();
            removeTextBox(activeSheet.id, selectedTextBoxId);
            setSelectedTextBoxId(null);
          } else if (selectedAnnotationId) {
            e.preventDefault();
            removeAnnotation(activeSheet.id, selectedAnnotationId);
            setSelectedAnnotationId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSheet, selectedChordId, selectedHighlightId, selectedTextBoxId, selectedAnnotationId, removeChord, removeHighlight, removeTextBox, removeAnnotation]);

  if (!activeSheet) {
    return (
      <main className="flex-1 h-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-8 select-none transition-colors duration-200">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
            <Music className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-['Jua']">선택된 악보가 없습니다</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            좌측 큐에서 악보를 선택하거나, 새로운 악보 이미지를 업로드하세요.
            찬양팀을 위한 무손실 키 변경과 세션 가이드가 자동으로 적용됩니다.
          </p>
        </div>
      </main>
    );
  }

  const semiDiff = getSemitoneDiff(activeSheet.detectedKey, activeSheet.currentKey);
  const preferFlat = FLAT_DOMINANT_KEYS.has(activeSheet.currentKey);

  const handleFinishTitleEdit = () => {
    if (activeSheet && titleInput.trim() && titleInput.trim() !== activeSheet.title) {
      updateSheetTitle(activeSheet.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleShiftSemitone = (delta: number) => {
    const currentRoot = extractRootNote(activeSheet.currentKey);
    const currentIndex = STANDARD_KEYS.indexOf(currentRoot);
    if (currentIndex === -1) return;
    const nextIndex = ((currentIndex + delta) % 12 + 12) % 12;
    setSheetKey(activeSheet.id, STANDARD_KEYS[nextIndex]);
  };

  // '이미지 저장' (무손실 내보내기)
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
    setSelectedTextBoxId(null);
    setSelectedAnnotationId(null);

    setIsSelecting(true);
    setStartPos({ x: x * scaleX, y: y * scaleY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = (activeSheet.naturalWidth / rect.width) * zoom;
    const scaleY = (activeSheet.naturalHeight / rect.height) * zoom;

    // 1. 요소 크기 조절 (Resize)
    if (resizeState) {
      const deltaX = (e.clientX - resizeState.startX) * scaleX;
      const deltaY = (e.clientY - resizeState.startY) * scaleY;
      const orig = resizeState.origBox;

      let newX = orig.x;
      let newY = orig.y;
      let newW = orig.width;
      let newH = orig.height;

      const handle = resizeState.handle;
      if (handle.includes('e')) newW = Math.max(20, orig.width + deltaX);
      if (handle.includes('s')) newH = Math.max(16, orig.height + deltaY);
      if (handle.includes('w')) {
        const potentialW = orig.width - deltaX;
        if (potentialW >= 20) {
          newX = orig.x + deltaX;
          newW = potentialW;
        }
      }
      if (handle.includes('n')) {
        const potentialH = orig.height - deltaY;
        if (potentialH >= 16) {
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

    // 2. 요소 드래그 이동
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

    // 3. 신규 영역 드래그 선택
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
    // 1. 리사이즈 완료 시 저장
    if (resizeState) {
      const { type, id, currentBox } = resizeState;
      if (type === 'chord') resizeChord(activeSheet.id, id, currentBox);
      else if (type === 'highlight') resizeHighlight(activeSheet.id, id, currentBox);
      else if (type === 'textBox') resizeTextBox(activeSheet.id, id, currentBox);
      else if (type === 'annotation') resizeAnnotation(activeSheet.id, id, currentBox);
      setResizeState(null);
      return;
    }

    // 2. 드래그 이동 완료 시 저장
    if (dragState) {
      const { type, id, currentBox } = dragState;
      if (type === 'chord') moveChord(activeSheet.id, id, currentBox);
      else if (type === 'highlight') moveHighlight(activeSheet.id, id, currentBox);
      else if (type === 'textBox') moveTextBox(activeSheet.id, id, currentBox);
      else if (type === 'annotation') moveAnnotation(activeSheet.id, id, currentBox);
      setDragState(null);
      return;
    }

    // 3. 신규 선택 영역 확정
    if (isSelecting) {
      if (currentBox && currentBox.width > 20 && currentBox.height > 15) {
        if (isAiAutoFixMode) {
          const capturedBox = { ...currentBox };
          setAiTargetBox(capturedBox);
          setSelectionBox(capturedBox);

          if (imageRef.current) {
            try {
              const snippet = cropImageSnippet(imageRef.current, capturedBox);
              setAiSnippetUrl(snippet);
            } catch (err) {
              console.error('Failed to crop snippet:', err);
            }
          }

          // 0.5초 뒤에 페이드인으로 빠르지만 조오금 부드럽게 UI가 나옴
          if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
          aiTimerRef.current = setTimeout(() => {
            setIsAiModalOpen(true);
          }, 500);
        } else {
          setSelectionBox(currentBox);
        }
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
    type: 'chord' | 'highlight' | 'textBox' | 'annotation',
    id: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setSelectedChordId(type === 'chord' ? id : null);
    setSelectedHighlightId(type === 'highlight' ? id : null);
    setSelectedTextBoxId(type === 'textBox' ? id : null);
    setSelectedAnnotationId(type === 'annotation' ? id : null);

    setDragState({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origBox: { ...box },
      currentBox: { ...box },
    });
  };

  // 요소 리사이즈 핸들 드래그 시작
  const handleResizeStart = (
    e: React.MouseEvent,
    type: 'chord' | 'highlight' | 'textBox' | 'annotation',
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

  // PowerPoint 스타일 리사이즈 핸들 렌더링
  const renderResizeHandles = (
    type: 'chord' | 'highlight' | 'textBox' | 'annotation',
    id: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    const handleClass = "absolute w-2.5 h-2.5 bg-white border border-slate-900 rounded-sm shadow-md z-40";
    return (
      <>
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'nw', box)} className={`${handleClass} -top-1.5 -left-1.5 cursor-nwse-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'ne', box)} className={`${handleClass} -top-1.5 -right-1.5 cursor-nesw-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'se', box)} className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'sw', box)} className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'n', box)} className={`${handleClass} -top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 's', box)} className={`${handleClass} -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'w', box)} className={`${handleClass} top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize`} />
        <div onMouseDown={(e) => handleResizeStart(e, type, id, 'e', box)} className={`${handleClass} top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize`} />
      </>
    );
  };

  const activeSheetIndex = sheets.findIndex((s) => s.id === activeSheetId);
  const textBoxesList = activeSheet.textBoxes || [];
  const annotationsList = activeSheet.annotations || [];

  return (
    <main className="flex-1 h-full bg-slate-100 dark:bg-slate-950 flex flex-col min-w-0 select-none overflow-hidden transition-colors duration-200 relative">
      {/* 실시간 알림 토스트 팝업 */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-slate-700/80 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top duration-200">
          <span className="text-xs font-bold font-['Jua'] tracking-wide">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-0.5 text-slate-400 hover:text-white rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. 상단 툴바 영역 */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 transition-colors duration-200 shadow-sm z-20">
        {/* 상단 1행: 악보 정보 & 제목 인라인 수정 (NotebookLM) & 주요 액션 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="px-2.5 py-0.8 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs shadow-sm font-['Jua'] flex-shrink-0">
              {activeSheetIndex !== -1 ? `${activeSheetIndex + 1}번곡` : '악보'}
            </span>

            {/* NotebookLM 스타일 제목 인라인 클릭 수정 */}
            {isEditingTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleFinishTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishTitleEdit();
                  if (e.key === 'Escape') {
                    setTitleInput(activeSheet.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="px-2 py-0.5 text-base font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-emerald-500 rounded-lg outline-none font-['Jua'] tracking-wide max-w-sm"
              />
            ) : (
              <div
                onClick={() => {
                  setTitleInput(activeSheet.title);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors max-w-md truncate"
                title="클릭하여 악보 제목 수정 (NotebookLM 방식)"
              >
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate font-['Jua'] tracking-wide">
                  {activeSheet.title}
                </h2>
                <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            )}

            {/* Jua 폰트가 적용된 원곡 & 연주 Key 배지 */}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-['Jua'] tracking-wider flex-shrink-0">
              원곡 : {activeSheet.detectedKey} Key
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-['Jua'] tracking-wider font-bold flex-shrink-0">
              연주 : {activeSheet.currentKey} Key
            </span>
            {semiDiff !== 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-['Jua'] font-bold flex-shrink-0">
                {semiDiff > 0 ? `+${semiDiff}` : semiDiff} 반음 전조
              </span>
            )}
          </div>

          {/* 우측 주요 버튼들 */}
          <div className="flex items-center gap-2">
            {/* 세션 가이드 표시 ON / OFF 토글 */}
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
              <span className="font-['Jua']">세션 가이드 {showHighlights ? 'ON' : 'OFF'}</span>
            </button>

            {/* AI 악보 코드 전수 분석 */}
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

            {/* 원곡 영상 보기 (콘티 링크 배정 시) */}
            {activeSheet.videoUrl && (
              <button
                onClick={() => openVideoPlayer(activeSheet)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors font-bold shadow-sm"
                title="이 악보의 원곡 영상을 전체화면으로 재생합니다 (ESC로 닫기)"
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>원곡 영상 보기</span>
                {activeSheet.videoDownloadStatus === 'completed' && (
                  <span className="text-[10px] text-emerald-500 font-normal">(로컬)</span>
                )}
                {activeSheet.videoDownloadStatus === 'downloading' && (
                  <span className="text-[10px] text-amber-500 font-normal">({activeSheet.videoDownloadProgress || 0}%)</span>
                )}
              </button>
            )}

            {/* 이미지 저장 (명칭 변경) */}
            <button
              onClick={handleExportPng}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors font-bold shadow-sm"
              title="현재 키로 전조된 악보를 고화질 이미지 파일로 저장합니다"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>이미지 저장</span>
            </button>

            {/* '악보 편집 모드' 대형 전환 버튼 (일반 모드일 때만 크게 노출) */}
            {!isEditMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"
                title="사이드바를 숨기고 악보를 화면 가득 확대하여 코드, 가이드, 글상자, 기호를 자유롭게 편집합니다"
              >
                <Palette className="w-4 h-4" />
                <span className="text-sm tracking-wide">🎨 악보 편집 모드</span>
              </button>
            )}
          </div>
        </div>

        {/* 악보 편집 모드 진입 시 전용 상단 툴바 표시 */}
        {isEditMode ? (
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/50 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold font-['Jua'] flex items-center gap-1.5 shadow-sm">
                <Palette className="w-3.5 h-3.5 animate-pulse" />
                악보 편집 모드
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                원하는 요소를 추가하고, 마우스로 드래그하여 위치 및 크기를 자유롭게 변경하세요. (Delete키로 삭제)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* + 코드 추가 */}
              <button
                onClick={() => {
                  setSelectionBox(null);
                  setIsChordModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 transition-colors font-bold font-['Jua'] shadow-sm"
              >
                <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>+ 코드 추가</span>
              </button>

              {/* + 가이드 추가 */}
              <button
                onClick={() => {
                  setSelectionBox(null);
                  setEditingHighlight(null);
                  setIsHighlightModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-300 dark:border-slate-700 hover:border-amber-500 transition-colors font-bold font-['Jua'] shadow-sm"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>+ 가이드 추가</span>
              </button>

              {/* + 글상자 추가 */}
              <button
                onClick={() => {
                  setSelectionBox(null);
                  setEditingTextBox(null);
                  setIsTextBoxModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-300 dark:border-slate-700 hover:border-blue-500 transition-colors font-bold font-['Jua'] shadow-sm"
              >
                <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>+ 글상자 추가</span>
              </button>

              {/* + 아이콘 추가 */}
              <button
                onClick={() => {
                  setSelectionBox(null);
                  setEditingAnnotation(null);
                  setIsAnnotationModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-colors font-bold font-['Jua'] shadow-sm"
              >
                <Stamp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>+ 아이콘 추가</span>
              </button>

              {/* ✨ AI 자동 수정 */}
              <button
                onClick={() => {
                  const nextMode = !isAiAutoFixMode;
                  setIsAiAutoFixMode(nextMode);
                  setSelectionBox(null);
                  setCurrentBox(null);
                  if (nextMode) {
                    setToastMessage('✨ 악보 위에서 필기나 기호(V, C, C2 등)가 있는 부분을 마우스로 드래그하세요.');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all font-bold font-['Jua'] shadow-sm ${
                  isAiAutoFixMode
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-purple-500/30 ring-2 ring-purple-400/50 scale-105'
                    : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-300 dark:border-purple-800 hover:border-purple-500'
                }`}
                title="악보의 원하는 영역을 드래그하여 필기를 지우거나(클린) 디지털 글자(V, C, C2 등)로 변경합니다"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiAutoFixMode ? 'text-white animate-spin' : 'text-purple-600 dark:text-purple-400'}`} />
                <span>✨ AI 자동 수정</span>
              </button>

              {/* 요소 목록 관리 패널 토글 */}
              <button
                onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors font-bold font-['Jua'] shadow-sm ${
                  isSidePanelOpen
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>요소 목록</span>
              </button>

              {/* ✓ 편집 완료 버튼 */}
              <button
                onClick={() => setEditMode(false)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all font-['Jua']"
                title="편집을 마치고 메인 콘티 화면으로 돌아갑니다"
              >
                <Check className="w-4 h-4" />
                <span>✓ 편집 완료</span>
              </button>
            </div>
          </div>
        ) : (
          /* 상단 2행: 12 Key Selector */
          <div className="flex items-center gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-['Jua']">원터치 키 체인지:</span>
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
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium font-['Jua']"
                  title="원곡 키로 되돌리기"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>원키</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. 메인 워크스페이스 (중앙 캔버스 + 우측 요소 관리 패널) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 캔버스 스크롤 컨테이너 */}
        <div 
          ref={containerRef}
          onMouseDown={(e) => {
            if (e.target === containerRef.current) {
              setSelectionBox(null);
              setCurrentBox(null);
              setSelectedChordId(null);
              setSelectedHighlightId(null);
              setSelectedTextBoxId(null);
              setSelectedAnnotationId(null);
            }
          }}
          className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-6 flex flex-col items-center justify-start transition-colors duration-200 relative"
        >
          {/* AI 자동 수정 안내 플로팅 배지 */}
          {isAiAutoFixMode && (
            <div className="sticky top-2 z-40 mb-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-['Jua'] tracking-wide border border-purple-400/40 backdrop-blur-md animate-in fade-in duration-200">
              <Sparkles className="w-4 h-4 animate-spin text-purple-200" />
              <span>악보 위에서 필기나 기호(V, C, C2 등)가 있는 부분을 마우스로 드래그하세요 (ESC 취소)</span>
              <button 
                onClick={() => setIsAiAutoFixMode(false)}
                className="ml-1 p-0.5 rounded-lg hover:bg-white/20 text-purple-200 hover:text-white transition-colors"
                title="AI 자동 수정 모드 닫기"
              >
                ✕
              </button>
            </div>
          )}

          {/* 악보 이미지 및 대화형 오버레이 레이어 */}
          <div 
            className={`relative shadow-2xl rounded-lg border border-slate-300 dark:border-slate-800 bg-white transition-transform duration-100 origin-top mb-12 ${
              isAiAutoFixMode ? 'cursor-crosshair ring-4 ring-purple-500/30' : ''
            }`}
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

            {/* 대화형 인터랙티브 코드 박스 레이어 */}
            {activeSheet.chords.map((chord) => {
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

              const isDraggingThis = dragState && dragState.type === 'chord' && dragState.id === chord.id;
              const isResizingThis = resizeState && resizeState.type === 'chord' && resizeState.id === chord.id;

              return (
                <React.Fragment key={chord.id}>
                  {/* 드래그 중 원래 자리에 생기는 복제 잔상 가림 마스크 */}
                  {isDraggingThis && (
                    <div
                      className="absolute bg-white/95 rounded pointer-events-none z-10"
                      style={{
                        left: `${(dragState.origBox.x / activeSheet.naturalWidth) * 100}%`,
                        top: `${(dragState.origBox.y / activeSheet.naturalHeight) * 100}%`,
                        width: `${(dragState.origBox.width / activeSheet.naturalWidth) * 100}%`,
                        height: `${(dragState.origBox.height / activeSheet.naturalHeight) * 100}%`,
                      }}
                    />
                  )}

                  <div
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
                    {/* 드래그/리사이즈 중 글씨가 마우스 따라 실시간 이동 */}
                    {(isDraggingThis || isResizingThis) && (
                      <div
                        className="w-full h-full flex items-center justify-center font-bold font-['Jua'] text-slate-900 bg-white/95 rounded shadow-md border border-emerald-500 pointer-events-none select-none text-center"
                        style={{ fontSize: `${Math.max(14, Math.min(Math.round(bh * 0.8), 32))}px` }}
                      >
                        {displayChord}
                      </div>
                    )}

                    {isSelected && renderResizeHandles('chord', chord.id, { x: bx, y: by, width: bw, height: bh })}

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
                </React.Fragment>
              );
            })}

            {/* 대화형 인터랙티브 세션 가이드 레이어 */}
            {activeSheet.sessionHighlights.map((hl) => {
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

              const isDraggingThis = dragState && dragState.type === 'highlight' && dragState.id === hl.id;
              const isResizingThis = resizeState && resizeState.type === 'highlight' && resizeState.id === hl.id;

              return (
                <React.Fragment key={hl.id}>
                  {/* 드래그 중 원래 자리 가림 마스크 */}
                  {isDraggingThis && (
                    <div
                      className="absolute bg-white/90 rounded-lg pointer-events-none z-10"
                      style={{
                        left: `${(dragState.origBox.x / activeSheet.naturalWidth) * 100}%`,
                        top: `${(dragState.origBox.y / activeSheet.naturalHeight) * 100}%`,
                        width: `${(dragState.origBox.width / activeSheet.naturalWidth) * 100}%`,
                        height: `${(dragState.origBox.height / activeSheet.naturalHeight) * 100}%`,
                      }}
                    />
                  )}

                  <div
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
                    {/* 드래그/리사이즈 중 가이드 박스 실시간 이동 */}
                    {(isDraggingThis || isResizingThis) && (
                      <div 
                        className="w-full h-full rounded-lg pointer-events-none select-none flex items-start p-1 shadow-inner"
                        style={{
                          backgroundColor: hl.backgroundColor || 'rgba(59, 130, 246, 0.25)',
                          border: `2px solid ${hl.borderColor || hl.color || '#3b82f6'}`,
                        }}
                      >
                        <span 
                          className="px-1.5 py-0.5 rounded text-[11px] font-bold font-['Jua'] shadow"
                          style={{
                            backgroundColor: hl.borderColor || '#3b82f6',
                            color: hl.textColor || '#ffffff',
                          }}
                        >
                          {hl.label}
                        </span>
                      </div>
                    )}

                    {isSelected && renderResizeHandles('highlight', hl.id, { x: hx, y: hy, width: hw, height: hh })}

                    {isSelected && (
                      <div 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -top-9 left-2 z-50 bg-slate-900 text-white rounded-lg px-2.5 py-1 text-xs shadow-2xl flex items-center gap-2 border border-slate-700 whitespace-nowrap"
                      >
                        <span className="font-bold text-amber-400 font-['Jua']">{hl.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingHighlight(hl);
                            setIsHighlightModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                          title="가이드 색상/라벨 수정"
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
                </React.Fragment>
              );
            })}

            {/* 대화형 인터랙티브 글상자 (Text Box) 레이어 */}
            {textBoxesList.map((tb) => {
              let activeBox = tb.box;
              const isDraggingThis = dragState && dragState.type === 'textBox' && dragState.id === tb.id;
              const isResizingThis = resizeState && resizeState.type === 'textBox' && resizeState.id === tb.id;

              if (isDraggingThis) {
                activeBox = dragState.currentBox;
              } else if (isResizingThis) {
                activeBox = resizeState.currentBox;
              }

              const tx = activeBox.x <= 1 ? activeBox.x * activeSheet.naturalWidth : activeBox.x;
              const ty = activeBox.y <= 1 ? activeBox.y * activeSheet.naturalHeight : activeBox.y;
              const tw = activeBox.width <= 1 ? activeBox.width * activeSheet.naturalWidth : activeBox.width;
              const th = activeBox.height <= 1 ? activeBox.height * activeSheet.naturalHeight : activeBox.height;

              const isSelected = selectedTextBoxId === tb.id;

              return (
                <React.Fragment key={tb.id}>
                  {/* 드래그 중 원래 자리 가림 마스크 */}
                  {isDraggingThis && (
                    <div
                      className="absolute bg-white/95 rounded pointer-events-none z-10"
                      style={{
                        left: `${(dragState.origBox.x / activeSheet.naturalWidth) * 100}%`,
                        top: `${(dragState.origBox.y / activeSheet.naturalHeight) * 100}%`,
                        width: `${(dragState.origBox.width / activeSheet.naturalWidth) * 100}%`,
                        height: `${(dragState.origBox.height / activeSheet.naturalHeight) * 100}%`,
                      }}
                    />
                  )}

                  <div
                    onMouseDown={(e) => handleItemDragStart(e, 'textBox', tb.id, { x: tx, y: ty, width: tw, height: th })}
                    className={`absolute cursor-move select-none transition-shadow ${
                      isSelected
                        ? 'border-2 border-blue-500 ring-2 ring-blue-400/40 z-30 rounded-lg shadow-lg'
                        : 'hover:border-2 hover:border-blue-400/60 z-10 rounded-lg'
                    }`}
                    style={{
                      left: `${(tx / activeSheet.naturalWidth) * 100}%`,
                      top: `${(ty / activeSheet.naturalHeight) * 100}%`,
                      width: `${(tw / activeSheet.naturalWidth) * 100}%`,
                      height: `${(th / activeSheet.naturalHeight) * 100}%`,
                    }}
                    title={`글상자: ${tb.text} (드래그 이동 / 핸들 크기조절 / Delete키 삭제)`}
                  >
                    {/* 드래그/리사이즈 중 글상자 텍스트 실시간 이동 */}
                    {(isDraggingThis || isResizingThis) && (
                      <div
                        className="w-full h-full pointer-events-none select-none p-1 overflow-hidden rounded bg-white/95 shadow-md border border-blue-400"
                        style={{
                          color: tb.color || '#1d4ed8',
                          fontSize: `${tb.fontSize || 26}px`,
                          fontFamily: FONT_OPTIONS.find((f) => f.id === tb.fontFamily)?.family || `'${tb.fontFamily || 'Jua'}', sans-serif`,
                          lineHeight: 1.25,
                        }}
                      >
                        <div className="font-bold whitespace-pre-wrap">{tb.text}</div>
                      </div>
                    )}

                    {isSelected && renderResizeHandles('textBox', tb.id, { x: tx, y: ty, width: tw, height: th })}

                    {isSelected && (
                      <div 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -top-9 left-1 z-50 bg-slate-900 text-white rounded-lg px-2.5 py-1 text-xs shadow-2xl flex items-center gap-2 border border-slate-700 whitespace-nowrap"
                      >
                        <span className="font-bold text-blue-400 font-['Jua'] truncate max-w-[120px]">{tb.text}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTextBox(tb);
                            setIsTextBoxModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                          title="글상자 수정"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextBox(activeSheet.id, tb.id);
                            setSelectedTextBoxId(null);
                          }}
                          className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                          title="글상자 삭제 (Delete)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextBoxId(null);
                          }}
                          className="p-0.5 text-slate-500 hover:text-slate-300"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* 대화형 인터랙티브 악보 기호 아이콘 (Annotation Icons: |, ✓, (, )) 레이어 */}
            {annotationsList.map((anno) => {
              let activeBox = anno.box;
              const isDraggingThis = dragState && dragState.type === 'annotation' && dragState.id === anno.id;
              const isResizingThis = resizeState && resizeState.type === 'annotation' && resizeState.id === anno.id;

              if (isDraggingThis) {
                activeBox = dragState.currentBox;
              } else if (isResizingThis) {
                activeBox = resizeState.currentBox;
              }

              const ax = activeBox.x <= 1 ? activeBox.x * activeSheet.naturalWidth : activeBox.x;
              const ay = activeBox.y <= 1 ? activeBox.y * activeSheet.naturalHeight : activeBox.y;
              const aw = activeBox.width <= 1 ? activeBox.width * activeSheet.naturalWidth : activeBox.width;
              const ah = activeBox.height <= 1 ? activeBox.height * activeSheet.naturalHeight : activeBox.height;

              const isSelected = selectedAnnotationId === anno.id;
              const symbolLabel = anno.iconType === 'bar' ? '|' : anno.iconType === 'check' ? '✓' : anno.iconType === 'paren_open' ? '(' : ')';
              const sw = anno.strokeWidth || 4;

              return (
                <React.Fragment key={anno.id}>
                  {/* 드래그 중 원래 자리 가림 마스크 */}
                  {isDraggingThis && (
                    <div
                      className="absolute bg-white/95 rounded pointer-events-none z-10"
                      style={{
                        left: `${(dragState.origBox.x / activeSheet.naturalWidth) * 100}%`,
                        top: `${(dragState.origBox.y / activeSheet.naturalHeight) * 100}%`,
                        width: `${(dragState.origBox.width / activeSheet.naturalWidth) * 100}%`,
                        height: `${(dragState.origBox.height / activeSheet.naturalHeight) * 100}%`,
                      }}
                    />
                  )}

                  <div
                    onMouseDown={(e) => handleItemDragStart(e, 'annotation', anno.id, { x: ax, y: ay, width: aw, height: ah })}
                    className={`absolute cursor-move select-none transition-shadow ${
                      isSelected
                        ? 'border-2 border-indigo-500 ring-2 ring-indigo-400/40 z-30 rounded shadow-lg'
                        : 'hover:border-2 hover:border-indigo-400/60 z-10 rounded'
                    }`}
                    style={{
                      left: `${(ax / activeSheet.naturalWidth) * 100}%`,
                      top: `${(ay / activeSheet.naturalHeight) * 100}%`,
                      width: `${(aw / activeSheet.naturalWidth) * 100}%`,
                      height: `${(ah / activeSheet.naturalHeight) * 100}%`,
                    }}
                    title={`기호: ${symbolLabel} (드래그 이동 / 핸들 크기조절 / Delete키 삭제)`}
                  >
                    {/* 드래그/리사이즈 중 기호 모양 실시간 이동 */}
                    {(isDraggingThis || isResizingThis) && (
                      <div className="w-full h-full pointer-events-none select-none flex items-center justify-center bg-white/70 rounded shadow-sm border border-indigo-400">
                        {anno.iconType === 'bar' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <line x1="50" y1="4" x2="50" y2="96" stroke={anno.color || '#ef4444'} strokeWidth={sw * (100 / Math.max(ah, 1))} strokeLinecap="round" />
                          </svg>
                        )}
                        {anno.iconType === 'check' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polyline points="15,52 40,82 90,18" fill="none" stroke={anno.color || '#ef4444'} strokeWidth={sw * (100 / Math.max(ah, 1))} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {anno.iconType === 'paren_open' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M 82 4 Q 8 50 82 96" fill="none" stroke={anno.color || '#ef4444'} strokeWidth={sw * (100 / Math.max(ah, 1))} strokeLinecap="round" />
                          </svg>
                        )}
                        {anno.iconType === 'paren_close' && (
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M 18 4 Q 92 50 18 96" fill="none" stroke={anno.color || '#ef4444'} strokeWidth={sw * (100 / Math.max(ah, 1))} strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                    )}

                    {isSelected && renderResizeHandles('annotation', anno.id, { x: ax, y: ay, width: aw, height: ah })}

                    {isSelected && (
                      <div 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute -top-9 left-1 z-50 bg-slate-900 text-white rounded-lg px-2.5 py-1 text-xs shadow-2xl flex items-center gap-2 border border-slate-700 whitespace-nowrap"
                      >
                        <span className="font-bold text-indigo-400 font-['Jua'] text-sm">{symbolLabel}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAnnotation(anno);
                            setIsAnnotationModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                          title="기호 수정"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAnnotation(activeSheet.id, anno.id);
                            setSelectedAnnotationId(null);
                          }}
                          className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                          title="기호 삭제 (Delete)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAnnotationId(null);
                          }}
                          className="p-0.5 text-slate-500 hover:text-slate-300"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* 마우스 드래그 중인 임시 박스 시각화 */}
            {currentBox && isSelecting && imageRef.current && (
              <div
                className={`absolute pointer-events-none z-20 ${
                  isAiAutoFixMode
                    ? 'border-2 border-dashed border-purple-500 bg-purple-500/25 ring-2 ring-purple-400/50'
                    : 'border-2 border-dashed border-emerald-400 bg-emerald-400/20'
                }`}
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
                  className={`absolute pointer-events-none z-20 rounded shadow-md ${
                    isAiAutoFixMode
                      ? 'border-2 border-purple-500 bg-purple-500/20 ring-2 ring-purple-400/50 animate-pulse'
                      : 'border-2 border-emerald-400 bg-emerald-400/20 ring-2 ring-emerald-500/30'
                  }`}
                  style={{
                    left: `${(selectionBox.x / activeSheet.naturalWidth) * 100}%`,
                    top: `${(selectionBox.y / activeSheet.naturalHeight) * 100}%`,
                    width: `${(selectionBox.width / activeSheet.naturalWidth) * 100}%`,
                    height: `${(selectionBox.height / activeSheet.naturalHeight) * 100}%`,
                  }}
                />

                {!isAiAutoFixMode && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 shadow-2xl flex items-center gap-1.5 select-none"
                    style={{
                      left: `${Math.max(2, Math.min(75, (selectionBox.x / activeSheet.naturalWidth) * 100))}%`,
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
                      className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors shadow-sm flex items-center gap-1 font-['Jua']"
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>코드 지정</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingHighlight(null);
                        setIsHighlightModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-sm flex items-center gap-1 font-['Jua']"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>가이드 지정</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTextBox(null);
                        setIsTextBoxModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-sm flex items-center gap-1 font-['Jua']"
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>글상자 지정</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (imageRef.current && selectionBox) {
                          const snippet = cropImageSnippet(imageRef.current, selectionBox);
                          setAiSnippetUrl(snippet);
                          setAiTargetBox(selectionBox);
                          if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
                          aiTimerRef.current = setTimeout(() => {
                            setIsAiModalOpen(true);
                          }, 500);
                        }
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-sm flex items-center gap-1 font-['Jua'] active:scale-95"
                      title="선택한 영역을 AI로 수정 (클린/변경)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI 수정</span>
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
                )}
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
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 px-1 font-['Jua']">
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
            className="px-2 py-1 text-[11px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-['Jua']"
          >
            100%
          </button>
        </div>

        {/* 3. 우측 "악보 요소 목록 관리 패널" (코드, 가이드, 글상자, 아이콘 4개 탭) */}
        {isSidePanelOpen && (
          <aside className="w-80 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-['Jua']">
                악보 요소 관리
              </h3>
              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4종 탭 전환 버튼 */}
            <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950/40 text-center">
              <button
                onClick={() => setActiveTab('chords')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors font-['Jua'] ${
                  activeTab === 'chords'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                코드({activeSheet.chords.length})
              </button>
              <button
                onClick={() => setActiveTab('highlights')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors font-['Jua'] ${
                  activeTab === 'highlights'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                가이드({activeSheet.sessionHighlights.length})
              </button>
              <button
                onClick={() => setActiveTab('textBoxes')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors font-['Jua'] ${
                  activeTab === 'textBoxes'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                글상자({textBoxesList.length})
              </button>
              <button
                onClick={() => setActiveTab('annotations')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors font-['Jua'] ${
                  activeTab === 'annotations'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                기호({annotationsList.length})
              </button>
            </div>

            {/* 탭 내용 리스트 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === 'chords' && (
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
              )}

              {activeTab === 'highlights' && (
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
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10" 
                          style={{ backgroundColor: hl.borderColor || hl.color || '#f59e0b' }} 
                        />
                        <span className="font-bold text-slate-900 dark:text-white font-['Jua']">
                          {hl.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingHighlight(hl);
                            setIsHighlightModalOpen(true);
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

              {activeTab === 'textBoxes' && (
                textBoxesList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">등록된 글상자가 없습니다.</p>
                ) : (
                  textBoxesList.map((tb) => (
                    <div
                      key={tb.id}
                      onClick={() => setSelectedTextBoxId(tb.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedTextBoxId === tb.id
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Type className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tb.color || '#2563eb' }} />
                        <span className="font-bold text-slate-900 dark:text-white font-['Jua'] truncate">
                          {tb.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTextBox(tb);
                            setIsTextBoxModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="글상자 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextBox(activeSheet.id, tb.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="글상자 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'annotations' && (
                annotationsList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">등록된 기호 아이콘이 없습니다.</p>
                ) : (
                  annotationsList.map((anno) => {
                    const symbolLabel = anno.iconType === 'bar' ? '|' : anno.iconType === 'check' ? '✓' : anno.iconType === 'paren_open' ? '(' : ')';
                    const typeKorean = anno.iconType === 'bar' ? '세로 막대' : anno.iconType === 'check' ? '체크 표시' : anno.iconType === 'paren_open' ? '여는 괄호' : '닫는 괄호';

                    return (
                      <div
                        key={anno.id}
                        onClick={() => setSelectedAnnotationId(anno.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          selectedAnnotationId === anno.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold font-['Jua'] text-sm" style={{ color: anno.color || '#2563eb' }}>
                            {symbolLabel}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white font-['Jua']">
                            {typeKorean} ({symbolLabel})
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAnnotation(anno);
                              setIsAnnotationModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                            title="기호 수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeAnnotation(activeSheet.id, anno.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                            title="기호 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 text-center font-['Jua']">
              💡 악보 위에서 요소를 마우스로 직접 끌어서 위치를 이동시키거나 크기를 조절할 수 있습니다.
            </div>
          </aside>
        )}
      </div>

      {/* 인라인 코드 텍스트 빠른 수정 모달 */}
      {editingChord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 font-['Jua']">코드 텍스트 수정</h3>
            <input
              type="text"
              value={editingChord.text}
              onChange={(e) => setEditingChord({ ...editingChord, text: e.target.value })}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-bold mb-4 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingChord(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-['Jua']"
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
                className="px-4 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow font-['Jua']"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4종 등록 / 수정 모달들 */}
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
          setEditingHighlight(null);
        }}
        initialHighlight={editingHighlight}
        initialBox={selectionBox || { 
          x: Math.round(activeSheet.naturalWidth * 0.1), 
          y: Math.round(activeSheet.naturalHeight * 0.3), 
          width: Math.round(activeSheet.naturalWidth * 0.8), 
          height: 90 
        }}
        onSave={(data) => {
          if (editingHighlight) {
            updateHighlight(activeSheet.id, editingHighlight.id, data.label, data.borderColor, data.backgroundColor);
          } else {
            addHighlight(activeSheet.id, {
              label: data.label,
              box: data.box || { 
                x: Math.round(activeSheet.naturalWidth * 0.1), 
                y: Math.round(activeSheet.naturalHeight * 0.3), 
                width: Math.round(activeSheet.naturalWidth * 0.8), 
                height: 90 
              },
              borderColor: data.borderColor,
              backgroundColor: data.backgroundColor,
              textColor: data.textColor,
            });
          }
        }}
      />

      <AddTextBoxModal
        isOpen={isTextBoxModalOpen}
        onClose={() => {
          setIsTextBoxModalOpen(false);
          setSelectionBox(null);
          setEditingTextBox(null);
        }}
        initialTextBox={editingTextBox}
        initialBox={selectionBox || {
          x: Math.round(activeSheet.naturalWidth * 0.1),
          y: Math.round(activeSheet.naturalHeight * 0.15),
          width: Math.round(activeSheet.naturalWidth * 0.3),
          height: 48,
        }}
        onSave={(data) => {
          if (editingTextBox) {
            updateTextBox(activeSheet.id, editingTextBox.id, {
              text: data.text,
              color: data.color,
              fontSize: data.fontSize,
              fontFamily: data.fontFamily,
            });
          } else {
            addTextBox(activeSheet.id, {
              text: data.text,
              color: data.color,
              fontSize: data.fontSize,
              fontFamily: data.fontFamily,
              box: data.box || {
                x: Math.round(activeSheet.naturalWidth * 0.1),
                y: Math.round(activeSheet.naturalHeight * 0.15),
                width: Math.round(activeSheet.naturalWidth * 0.3),
                height: 48,
              },
            });
          }
        }}
      />

      <AddAnnotationModal
        isOpen={isAnnotationModalOpen}
        onClose={() => {
          setIsAnnotationModalOpen(false);
          setSelectionBox(null);
          setEditingAnnotation(null);
        }}
        initialAnnotation={editingAnnotation}
        initialBox={selectionBox || undefined}
        onSave={(data) => {
          if (editingAnnotation) {
            updateAnnotation(activeSheet.id, editingAnnotation.id, {
              iconType: data.iconType,
              color: data.color,
              strokeWidth: data.strokeWidth,
            });
          } else {
            addAnnotation(activeSheet.id, {
              iconType: data.iconType,
              color: data.color,
              strokeWidth: data.strokeWidth,
              box: data.box || {
                x: Math.round(activeSheet.naturalWidth * 0.1),
                y: Math.round(activeSheet.naturalHeight * 0.25),
                width: 32,
                height: 48,
              },
            });
          }
        }}
      />

      <AiAutoFixModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          setIsAiAutoFixMode(false);
          setSelectionBox(null);
          setAiTargetBox(null);
          setAiSnippetUrl('');
        }}
        croppedSnippetUrl={aiSnippetUrl}
        targetBox={aiTargetBox || { x: 0, y: 0, width: 0, height: 0 }}
        sheetImage={imageRef.current}
        sheetId={activeSheet.id}
      />
    </main>
  );
};
