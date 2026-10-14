import React, { useState, useEffect } from 'react';
import { X, BookmarkPlus, Palette } from 'lucide-react';
import { HighlightArea } from '../types';
import { getContrastTextColor, createTranslucentColor, removeEmoji } from '../utils/colorUtils';

interface AddHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hlData: { label: string; borderColor: string; backgroundColor: string; textColor: string; box?: { x: number; y: number; width: number; height: number } }) => void;
  initialHighlight?: HighlightArea | null;
  initialBox?: { x: number; y: number; width: number; height: number };
}

const PRESET_COLORS = [
  { name: '오렌지/호박', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.22)' },
  { name: '레드/경고', border: '#ef4444', bg: 'rgba(239, 68, 68, 0.22)' },
  { name: '퍼플/빌드업', border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.22)' },
  { name: '블루/포커스', border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.22)' },
  { name: '그린/세션Full', border: '#10b981', bg: 'rgba(16, 185, 129, 0.22)' },
  { name: '시안/어쿠스틱', border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.22)' },
  { name: '핑크/피아노', border: '#ec4899', bg: 'rgba(236, 72, 153, 0.22)' },
  { name: '슬레이트/멘트', border: '#64748b', bg: 'rgba(100, 116, 139, 0.22)' },
  { name: '밝은 옐로우', border: '#eab308', bg: 'rgba(254, 240, 138, 0.45)' },
  { name: '화이트/클리어', border: '#e2e8f0', bg: 'rgba(255, 255, 255, 0.4)' },
];

const PRESET_LABELS = [
  '드럼 in',
  '브레이크 (Stop)',
  '빌드업 (고조)',
  '어쿠스틱 Only',
  '세션 Full (투티)',
  '피아노 Solo',
  '인도자 멘트/기도',
  '후렴 반복',
  '간주 (Interlude)',
];

export const AddHighlightModal: React.FC<AddHighlightModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHighlight,
  initialBox,
}) => {
  const [label, setLabel] = useState('드럼 in');
  const [borderColor, setBorderColor] = useState('#f59e0b');
  const [backgroundColor, setBackgroundColor] = useState('rgba(245, 158, 11, 0.22)');

  useEffect(() => {
    if (initialHighlight) {
      setLabel(removeEmoji(initialHighlight.label));
      const border = initialHighlight.borderColor || initialHighlight.color || '#f59e0b';
      setBorderColor(border);
      setBackgroundColor(initialHighlight.backgroundColor || createTranslucentColor(border, 0.22));
    } else {
      setLabel('드럼 in');
      setBorderColor('#f59e0b');
      setBackgroundColor('rgba(245, 158, 11, 0.22)');
    }
  }, [initialHighlight, isOpen]);

  if (!isOpen) return null;

  // 제목 뱃지 배경색(진한 테두리색) 및 내부 배경색 밝기 기반 자동 흑/백 텍스트 결정
  const badgeTextColor = getContrastTextColor(borderColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = removeEmoji(label.trim());
    if (!cleanLabel) return;

    onSave({
      label: cleanLabel,
      borderColor,
      backgroundColor,
      textColor: badgeTextColor,
      box: initialBox,
    });
    onClose();
  };

  const handleSelectColorPreset = (border: string, bg: string) => {
    setBorderColor(border);
    setBackgroundColor(bg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {initialHighlight ? '세션 가이드 수정' : '새 세션 가이드 추가'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 가이드 라벨 입력 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              가이드 명칭 (이모지 없이 깔끔하게 표기)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-bold"
              placeholder="예: 드럼 in, 후렴 반복, 브레이크"
            />
          </div>

          {/* 프리셋 버튼 */}
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">자주 쓰는 가이드 문구</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LABELS.map((pLabel) => (
                <button
                  type="button"
                  key={pLabel}
                  onClick={() => setLabel(pLabel)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition-colors"
                >
                  {pLabel}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 선택기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-500" />
                테두리 및 배경 색상
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-400">직접 지정:</span>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => {
                    const border = e.target.value;
                    setBorderColor(border);
                    setBackgroundColor(createTranslucentColor(border, 0.22));
                  }}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  title="테두리 색상 선택"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((p) => {
                const isSelected = borderColor.toLowerCase() === p.border.toLowerCase();
                return (
                  <button
                    type="button"
                    key={p.name}
                    onClick={() => handleSelectColorPreset(p.border, p.bg)}
                    className={`h-9 rounded-xl flex items-center justify-center border-2 transition-all ${
                      isSelected ? 'border-slate-900 dark:border-white scale-105 shadow-md' : 'border-transparent hover:scale-102'
                    }`}
                    style={{ backgroundColor: p.bg, borderColor: isSelected ? undefined : p.border }}
                    title={p.name}
                  >
                    <div className="w-4 h-4 rounded-full border border-black/20 shadow-sm" style={{ backgroundColor: p.border }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 실시간 렌더링 미리보기 */}
          <div className="pt-2">
            <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">악보 위 실제 표시 미리보기</label>
            <div className="relative p-6 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center">
              {/* 바깥 상단 접촉 뱃지 */}
              <div className="w-full relative">
                <div
                  className="inline-block px-3 py-1 rounded-t-md text-xs font-bold tracking-tight shadow-sm"
                  style={{
                    backgroundColor: borderColor,
                    color: badgeTextColor,
                  }}
                >
                  {label || '가이드 제목'}
                </div>
                <div
                  className="w-full h-12 rounded-b-lg rounded-tr-lg border-2 flex items-center justify-center text-xs font-medium"
                  style={{
                    borderColor: borderColor,
                    backgroundColor: backgroundColor,
                    color: getContrastTextColor(backgroundColor),
                  }}
                >
                  (악보 연주 구간 하이라이트)
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-center">
              * 제목 배경색 밝기에 따라 글씨 색이 자동으로 <b>{badgeTextColor === '#0f172a' ? '검정색' : '흰색'}</b>으로 최적화됩니다.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              {initialHighlight ? '수정 완료' : '가이드 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
