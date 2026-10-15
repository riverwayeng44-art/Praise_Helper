import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wand2, Eraser, Type, Check, RefreshCw } from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';
import { cleanSheetHandwriting } from '../utils/imageCleaner';
import { recognizeHandwritingWithAI, HandwritingRecognitionResult } from '../services/aiService';
import { FONT_OPTIONS } from './AddTextBoxModal';

interface AiAutoFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  croppedSnippetUrl: string;
  targetBox: { x: number; y: number; width: number; height: number };
  sheetImage: HTMLImageElement | null;
  sheetId: string;
}

export const AiAutoFixModal: React.FC<AiAutoFixModalProps> = ({
  isOpen,
  onClose,
  croppedSnippetUrl,
  targetBox,
  sheetImage,
  sheetId,
}) => {
  const { 
    apiConfig, 
    updateSheetOriginalImage, 
    addTextBox, 
    addAnnotation, 
    setToastMessage 
  } = useSheetStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // OCR 인식 후 확인 및 직접 수정 단계
  const [ocrResult, setOcrResult] = useState<HandwritingRecognitionResult | null>(null);
  const [customText, setCustomText] = useState('');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('praise_last_font') || 'Jua');

  // 모달이 새로 열릴 때마다 이전 OCR 상태 완전 초기화 (수정 후 다시 열었을 때 바로 클린/변경 선택창 나오도록 보장)
  React.useEffect(() => {
    if (isOpen) {
      setOcrResult(null);
      setCustomText('');
      setIsProcessing(false);
      setStatusMessage('');
      setFontFamily(localStorage.getItem('praise_last_font') || 'Jua');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. 악보 클린 (필기/낙서 삭제)
  const handleCleanSheet = async () => {
    if (!sheetImage) return;

    try {
      setIsProcessing(true);
      setStatusMessage('오선보를 보호하며 필기·낙서를 정밀 복원 중...');

      // 오선보 보존 지능형 필기 제거
      const cleanedDataUrl = await cleanSheetHandwriting(sheetImage, targetBox, {
        preserveStaffLines: true,
      });

      await updateSheetOriginalImage(sheetId, cleanedDataUrl);
      setToastMessage('🧹 오선보 손상 없이 필기가 깔끔하게 삭제되었습니다.');
      onClose();
    } catch (err) {
      console.error('Clean sheet error:', err);
      setToastMessage('⚠️ 악보 클린 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 악보 변경 (AI OCR 인식 시작)
  const handleStartOcr = async () => {
    try {
      setIsProcessing(true);
      setStatusMessage('AI가 필기 텍스트(V, C, C2, PC 등)를 분석하고 있습니다...');

      const result = await recognizeHandwritingWithAI(croppedSnippetUrl, apiConfig);
      setOcrResult(result);
      setCustomText(result.recognizedText);
    } catch (err) {
      console.error('OCR recognition error:', err);
      setOcrResult({
        recognizedText: 'C2',
        category: 'section',
        suggestedColor: '#1d4ed8',
        suggestedFontSize: 34,
      });
      setCustomText('C2');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2-1. 악보 변경 적용 (원본 필기 지우고 크고 선명한 디지털 글로 치환)
  const handleApplyReplacement = async () => {
    if (!sheetImage) return;

    try {
      setIsProcessing(true);
      setStatusMessage('원본 필기를 지우고 디지털 텍스트로 치환 중...');

      // 1) 원본 이미지에서 해당 필기 영역 지우기 (오선보 및 인접 인쇄 악보 철저 보호)
      const cleanedDataUrl = await cleanSheetHandwriting(sheetImage, targetBox, {
        preserveStaffLines: true,
      });
      await updateSheetOriginalImage(sheetId, cleanedDataUrl);

      // 2) 디지털 텍스트 또는 기호 삽입
      const textToUse = customText.trim() || ocrResult?.recognizedText || 'C2';
      const symbolType = ocrResult?.symbolType;

      if (symbolType && ['bar', 'check', 'paren_open', 'paren_close'].includes(symbolType)) {
        // 기호로 삽입
        await addAnnotation(sheetId, {
          iconType: symbolType,
          color: ocrResult?.suggestedColor || '#1d4ed8',
          strokeWidth: 4,
          box: {
            x: Math.round(targetBox.x),
            y: Math.round(targetBox.y),
            width: Math.max(32, Math.round(targetBox.width)),
            height: Math.max(44, Math.round(targetBox.height)),
          },
        });
      } else {
        // 악보를 가리지 않으면서 큰 크기를 유지하는 디지털 글상자 삽입
        const fontSize = Math.max(28, Math.min(Math.round(targetBox.height * 0.9), 46));
        const estimatedWidth = Math.max(
          Math.round(targetBox.width),
          Math.round(fontSize * Math.max(1.2, textToUse.length * 0.85))
        );
        const estimatedHeight = Math.max(Math.round(targetBox.height), Math.round(fontSize * 1.35));

        await addTextBox(sheetId, {
          text: textToUse,
          color: ocrResult?.suggestedColor || '#1d4ed8', // 찬양팀 블루
          fontSize,
          fontFamily,
          box: {
            x: Math.round(targetBox.x),
            y: Math.round(targetBox.y),
            width: estimatedWidth,
            height: estimatedHeight,
          },
        });

        try {
          localStorage.setItem('praise_last_font', fontFamily);
        } catch (e) {
          // ignore
        }
      }

      setToastMessage(`✨ '${textToUse}' 필기가 디지털 텍스트로 치환되었습니다.`);
      onClose();
    } catch (err) {
      console.error('Apply replacement error:', err);
      setToastMessage('⚠️ 디지털 치환 적용 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      {/* 정사각형이지만 모서리가 둥근 모양의 카드 UI (0.28s 부드러운 페이드인) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[440px] max-w-[94vw] aspect-square rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between p-6 select-none"
      >
        {/* 상단: 타이틀 & 닫기 버튼 */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-['Jua'] tracking-wide">
                AI 악보 자동 수정
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                선택한 악보 영역의 필기를 깔끔하게 처리합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 중단: 사용자가 드래그한 악보 영역 썸네일 미리보기 */}
        <div className="my-auto py-2 flex flex-col items-center justify-center">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 font-['Jua']">
            선택된 악보 영역
          </div>

          <div className="w-full max-h-[160px] rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-center overflow-hidden shadow-inner">
            {croppedSnippetUrl ? (
              <img
                src={croppedSnippetUrl}
                alt="Selected area"
                className="max-h-[140px] max-w-full object-contain rounded-lg drop-shadow"
              />
            ) : (
              <span className="text-xs text-slate-400">영역 미리보기 없음</span>
            )}
          </div>

          {/* OCR 결과가 나온 경우 확인창 */}
          {ocrResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mt-2.5 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-['Jua'] flex-shrink-0">
                    인식 텍스트:
                  </span>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    style={{
                      fontFamily: FONT_OPTIONS.find((f) => f.id === fontFamily)?.family || 'Jua, sans-serif',
                    }}
                    className="px-2.5 py-1 text-base font-bold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-slate-900 dark:text-white outline-none w-28 text-center shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOcrResult(null)}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  >
                    ← 다시 선택
                  </button>
                  <button
                    onClick={handleApplyReplacement}
                    disabled={isProcessing}
                    className="px-3.5 py-1.5 text-xs font-bold font-['Jua'] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>치환 적용</span>
                  </button>
                </div>
              </div>

              {/* 글씨체 5개 선택 바 */}
              <div className="pt-1 border-t border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  <span>치환 글씨체 선택:</span>
                  <span className="text-[10px] text-indigo-500 font-normal">선택 시 자동 기억</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {FONT_OPTIONS.map((f) => {
                    const isSelected = fontFamily === f.id;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          setFontFamily(f.id);
                          try {
                            localStorage.setItem('praise_last_font', f.id);
                          } catch (e) {}
                        }}
                        className={`py-1 text-[11px] rounded-lg border text-center transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                        }`}
                        style={{ fontFamily: f.family }}
                      >
                        {f.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 처리 중 로딩 인디케이터 */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-bold font-['Jua'] text-slate-800 dark:text-slate-100 tracking-wide text-center px-6">
              {statusMessage}
            </p>
          </div>
        )}

        {/* 하단: 선택 옵션 2개 버튼 */}
        {!ocrResult && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* 옵션 1. 악보 클린 (필기 삭제) */}
            <button
              onClick={handleCleanSheet}
              disabled={isProcessing}
              className="group p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all text-left flex flex-col justify-between shadow-sm active:scale-98"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Eraser className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-['Jua']">
                  1. 악보 클린
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                오선보 손상 없이 필기·낙서만 깨끗하게 삭제
              </p>
            </button>

            {/* 옵션 2. 악보 변경 (디지털 텍스트 치환) */}
            <button
              onClick={handleStartOcr}
              disabled={isProcessing}
              className="group p-3.5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all text-left flex flex-col justify-between shadow-sm active:scale-98"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Type className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-['Jua']">
                  2. 악보 변경
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                손글씨(V, C, C2, PC 등)를 크고 선명한 디지털 글로 치환
              </p>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
