import React, { useState } from 'react';
import { X, BookmarkPlus } from 'lucide-react';
import { HighlightArea } from '../types';
import { getHighlightColorForLabel } from '../utils/canvasRenderer';

interface AddHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHighlight: (hl: Omit<HighlightArea, 'id'>) => void;
  initialBox?: { x: number; y: number; width: number; height: number };
}

export const AddHighlightModal: React.FC<AddHighlightModalProps> = ({
  isOpen,
  onClose,
  onAddHighlight,
  initialBox,
}) => {
  const [label, setLabel] = useState('🥁 드럼 in');
  const [color, setColor] = useState('#f59e0b');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    onAddHighlight({
      label: label.trim(),
      box: initialBox || { x: 80, y: 300, width: 800, height: 100 },
      color: color || getHighlightColorForLabel(label),
    });
    onClose();
  };

  const presetLabels = [
    { label: '🥁 드럼 in', color: '#f59e0b' },
    { label: '⚡ 브레이크 (Stop)', color: '#ef4444' },
    { label: '📈 빌드업 (고조)', color: '#8b5cf6' },
    { label: '🎸 어쿠스틱 Only', color: '#06b6d4' },
    { label: '🔥 세션 Full (투티)', color: '#10b981' },
    { label: '🎹 피아노 Solo', color: '#ec4899' },
    { label: '🗣️ 인도자 멘트/기도', color: '#64748b' },
  ];

  const handleSelectPreset = (pLabel: string, pColor: string) => {
    setLabel(pLabel);
    setColor(pColor);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden select-none transition-colors duration-200">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">세션 가이드 하이라이트 추가</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              가이드 라벨 (예: 드럼 in, 빌드업, 브레이크)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-bold"
              placeholder="🥁 드럼 in"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">자주 쓰는 찬양팀 큐 프리셋</label>
            <div className="flex flex-wrap gap-1.5">
              {presetLabels.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => handleSelectPreset(item.label, item.color)}
                  className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md"
            >
              하이라이트 등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
