import React, { useEffect, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Eye, 
  EyeOff, 
  Maximize, 
  Minimize, 
  Music,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSheetStore } from '../store/useSheetStore';
import { getSemitoneDiff } from '../utils/transposer';

export const SlideShowModal: React.FC = () => {
  const { 
    isSlideMode, 
    sheets, 
    slideIndex, 
    exitSlideShow, 
    nextSlide, 
    prevSlide, 
    setSlideIndex,
    showHighlights, 
    toggleHighlights 
  } = useSheetStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [direction, setDirection] = useState<number>(1);

  const currentSheet = sheets[slideIndex];

  const handleNext = () => {
    setDirection(1);
    nextSlide();
  };

  const handlePrev = () => {
    setDirection(-1);
    prevSlide();
  };

  // 전체화면 토글
  const toggleFullscreen = () => {
    const api = (window as any).electronAPI;
    if (api && api.toggleFullscreen) {
      api.toggleFullscreen().then((isFull: boolean) => {
        setIsFullscreen(isFull);
      });
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    }
  };

  // 키보드 단축키 핸들러
  useEffect(() => {
    if (!isSlideMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          handlePrev();
          break;
        case 'Escape':
          e.preventDefault();
          exitSlideShow();
          break;
        case 'h':
        case 'H':
        case 'ㅗ':
          e.preventDefault();
          toggleHighlights();
          break;
        case 'F11':
        case 'f':
        case 'F':
        case 'ㄹ':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Home':
          e.preventDefault();
          setDirection(-1);
          setSlideIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setDirection(1);
          setSlideIndex(sheets.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideMode, slideIndex, sheets.length, exitSlideShow, toggleHighlights, setSlideIndex]);

  // 마우스 움직임 감지하여 컨트롤 패널 자동 숨김/표시
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, []);

  if (!isSlideMode || !currentSheet) return null;

  const semiDiff = getSemitoneDiff(currentSheet.detectedKey, currentSheet.currentKey);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden cursor-default">
      {/* 1. 상단 플로팅 정보 바 (호버 시 표시) */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-5 inset-x-8 z-30 flex items-center justify-between pointer-events-none"
          >
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-md pointer-events-auto">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                {slideIndex + 1}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide font-['Jua']">
                  {currentSheet.title}
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-bold font-mono">
                    {currentSheet.currentKey} Key
                  </span>
                  {semiDiff !== 0 && (
                    <span className="text-amber-400 font-mono text-[11px]">
                      (원곡 {currentSheet.detectedKey}에서 {semiDiff > 0 ? `+${semiDiff}` : semiDiff} 반음)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* 전체화면 버튼 */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                title="전체화면 토글 (단축키: F)"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>

              {/* 닫기 버튼 */}
              <button
                onClick={exitSlideShow}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                title="슬라이드 쇼 종료 (단축키: ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 중앙 악보 프레젠테이션 (화면 비율 유지하며 정중앙 배치) */}
      <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
        {/* 좌측 클릭 영역 (이전 슬라이드) */}
        <div
          onClick={handlePrev}
          className="absolute left-0 inset-y-0 w-1/4 z-20 cursor-w-resize group flex items-center pl-6"
        >
          <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-slate-700/60 text-slate-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-xl">
            <ChevronLeft className="w-6 h-6" />
          </div>
        </div>

        {/* 우측 클릭 영역 (다음 슬라이드) */}
        <div
          onClick={handleNext}
          className="absolute right-0 inset-y-0 w-1/4 z-20 cursor-e-resize group flex items-center justify-end pr-6"
        >
          <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-slate-700/60 text-slate-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-xl">
            <ChevronRight className="w-6 h-6" />
          </div>
        </div>

        {/* 실제 악보 이미지 (부드러운 슬라이드 밀림 전환, 검은 화면 깜빡임 완전 제거) */}
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={currentSheet.id}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                x: dir > 0 ? '60%' : '-60%',
                opacity: 0.2,
              }),
              center: {
                x: 0,
                opacity: 1,
              },
              exit: (dir: number) => ({
                x: dir > 0 ? '-60%' : '60%',
                opacity: 0.2,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'tween', duration: 0.3, ease: [0.25, 1, 0.5, 1] },
              opacity: { duration: 0.25 },
            }}
            className="w-full h-full flex items-center justify-center"
          >
            <img
              src={currentSheet.transposedImageUrl || currentSheet.originalImageUrl}
              alt={currentSheet.title}
              className="max-h-full max-w-full object-contain rounded-md shadow-2xl pointer-events-none drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3. 하단 플로팅 컨트롤 바 */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-6 z-30 flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-2.5 shadow-2xl backdrop-blur-md"
          >
            {/* 이전 곡 버튼 */}
            <button
              onClick={handlePrev}
              disabled={slideIndex === 0}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="이전 악보 (단축키: ← 또는 Space)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* 슬라이드 카운터 */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-mono text-sm font-bold border border-slate-700">
              <span className="text-emerald-400">{slideIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span>{sheets.length}</span>
            </div>

            {/* 다음 곡 버튼 */}
            <button
              onClick={handleNext}
              disabled={slideIndex === sheets.length - 1}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="다음 악보 (단축키: → 또는 Space)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            {/* 세션 가이드 하이라이트 토글 */}
            <button
              onClick={toggleHighlights}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                showHighlights
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="세션 가이드 하이라이트 ON/OFF (단축키: H)"
            >
              {showHighlights ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>세션 가이드 ({showHighlights ? 'ON' : 'OFF'})</span>
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            {/* 단축키 힌트 배지 */}
            <div className="text-[11px] text-slate-400 hidden md:block">
              넘김: <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Space</kbd> / <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">방향키</kbd> · 종료: <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">ESC</kbd>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
