import React, { useState, useEffect } from 'react';
import { X, Stamp, Palette } from 'lucide-react';
import { AnnotationIconItem, AnnotationType } from '../types';

interface AddAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { iconType: AnnotationType; color: string; box?: { x: number; y: number; width: number; height: number } }) => void;
  initialAnnotation?: AnnotationIconItem | null;
  initialBox?: { x: number; y: number; width: number; height: number };
}

const PRESET_ICONS: { type: AnnotationType; label: string; symbol: string; desc: string }[] = [
  { type: 'bar', label: '세로 막대 (|)', symbol: '|', desc: '마디 구분 또는 호흡 지점 표시' },
  { type: 'check', label: '체크 표시 (✓)', symbol: '✓', desc: '강조, 진입 또는 연주 큐 포인트' },
  { type: 'paren_open', label: '여는 괄호 ( ( )', symbol: '(', desc: '코드 또는 가사 시작 묶음' },
  { type: 'paren_close', label: '닫는 괄호 ( ) )', symbol: ')', desc: '코드 또는 가사 끝 묶음' },
];

const PRESET_ICON_COLORS = [
  { name: '찬양팀 블루', color: '#2563eb' },
  { name: '강조 레드', color: '#ef4444' },
  { name: '클래식 블랙', color: '#0f172a' },
  { name: '경고 앰버', color: '#f59e0b' },
  { name: '생동감 그린', color: '#10b981' },
  { name: '퍼플', color: '#8b5cf6' },
];

export const AddAnnotationModal: React.FC<AddAnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAnnotation,
  initialBox,
}) => {
  const [selectedType, setSelectedType] = useState<AnnotationType>('bar');
  const [color, setColor] = useState('#2563eb');

  useEffect(() => {
    if (initialAnnotation) {
      setSelectedType(initialAnnotation.iconType);
      setColor(initialAnnotation.color || '#2563eb');
    } else {
      setSelectedType('bar');
      setColor('#2563eb');
    }
  }, [initialAnnotation, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 기본 너비와 높이 설정
    let defaultWidth = 32;
    let defaultHeight = 48;
    if (selectedType === 'bar') {
      defaultWidth = 24;
      defaultHeight = 52;
    } else if (selectedType === 'check') {
      defaultWidth = 44;
      defaultHeight = 44;
    } else if (selectedType === 'paren_open' || selectedType === 'paren_close') {
      defaultWidth = 28;
      defaultHeight = 48;
    }

    const box = initialBox || { x: 150, y: 300, width: defaultWidth, height: defaultHeight };

    onSave({
      iconType: selectedType,
      color,
      box,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stamp className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 font-['Jua']">
              {initialAnnotation ? '악보 기호 수정' : '악보 기호 아이콘 추가'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 4종 기호 선택 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
              기호 종류 선택 (개별 단독 추가)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_ICONS.map((item) => {
                const isSelected = selectedType === item.type;
                return (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() => setSelectedType(item.type)}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50'
                    }`}
                  >
                    <span
                      className="text-2xl font-bold font-['Jua'] leading-none"
                      style={{ color: isSelected ? color : undefined }}
                    >
                      {item.symbol}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{item.label}</span>
                    <span className="text-[10px] text-slate-400 text-center leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 색상 선택 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-indigo-500" />
                기호 색상
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICON_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.name}
                  onClick={() => setColor(c.color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color.toLowerCase() === c.color.toLowerCase()
                      ? 'scale-115 border-slate-900 dark:border-white shadow-sm'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          <div className="pt-2">
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">악보 위 실제 표시 미리보기</label>
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center h-20">
              <span
                style={{
                  color,
                  fontSize: '40px',
                  fontFamily: 'Jua, sans-serif',
                }}
                className="font-bold select-none leading-none"
              >
                {selectedType === 'bar' && '|'}
                {selectedType === 'check' && '✓'}
                {selectedType === 'paren_open' && '('}
                {selectedType === 'paren_close' && ')'}
              </span>
            </div>
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
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md flex items-center gap-1.5"
            >
              <Stamp className="w-3.5 h-3.5" />
              {initialAnnotation ? '수정 완료' : '기호 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
