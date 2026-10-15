import React, { useState, useEffect } from 'react';
import { X, Type, Palette } from 'lucide-react';
import { TextBoxItem } from '../types';

interface AddTextBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { text: string; color: string; fontSize: number; fontFamily?: string; box?: { x: number; y: number; width: number; height: number } }) => void;
  initialTextBox?: TextBoxItem | null;
  initialBox?: { x: number; y: number; width: number; height: number };
}

const PRESET_TEXT_COLORS = [
  { name: '찬양팀 블루 (메모)', color: '#1d4ed8' },
  { name: '강조 레드 (주의)', color: '#dc2626' },
  { name: '클래식 블랙 (기본)', color: '#0f172a' },
  { name: '퍼플 (빌드업)', color: '#7c3aed' },
  { name: '그린 (파트/세션)', color: '#16a34a' },
  { name: '앰버/오렌지', color: '#d97706' },
];

const PRESET_SNIPPETS = [
  '인트로: 피아노 + 어쿠스틱',
  '후렴 2번 반복 후 엔딩',
  '드럼 킥 4비트 유지',
  'Acoustic Solo',
  'V -> C -> B -> C',
  '조용하게 피아노만',
];

export const FONT_OPTIONS = [
  { id: 'Jua', name: 'Jua (찬양팀 추천)', family: "'Jua', sans-serif" },
  { id: 'Dotum', name: '돋움 (깔끔한 고딕)', family: "'Dotum', '돋움', 'Malgun Gothic', sans-serif" },
  { id: 'Gungsuh', name: '궁서 (전통 서체)', family: "'Gungsuh', '궁서', 'Batang', serif" },
  { id: 'Myeongjo', name: '바른명조 (우아한 명조)', family: "'Nanum Myeongjo', '바른명조', 'Batang', serif" },
  { id: 'Round', name: '나눔스퀘어 (둥근)', family: "'NanumSquareRound', '맑은 고딕', sans-serif" },
];

export const AddTextBoxModal: React.FC<AddTextBoxModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTextBox,
  initialBox,
}) => {
  const [text, setText] = useState('');
  const [color, setColor] = useState('#1d4ed8');
  const [fontSize, setFontSize] = useState(26);
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('praise_last_font') || 'Jua');

  useEffect(() => {
    if (initialTextBox) {
      setText(initialTextBox.text);
      setColor(initialTextBox.color || '#1d4ed8');
      setFontSize(initialTextBox.fontSize || 26);
      setFontFamily(initialTextBox.fontFamily || localStorage.getItem('praise_last_font') || 'Jua');
    } else {
      setText('');
      setColor('#1d4ed8');
      setFontSize(26);
      setFontFamily(localStorage.getItem('praise_last_font') || 'Jua');
    }
  }, [initialTextBox, isOpen]);

  if (!isOpen) return null;

  const handleSelectFont = (fontId: string) => {
    setFontFamily(fontId);
    try {
      localStorage.setItem('praise_last_font', fontId);
    } catch (e) {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    onSave({
      text: text.trim(),
      color,
      fontSize,
      fontFamily,
      box: initialBox,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-['Jua']">
              {initialTextBox ? '글상자 수정' : '새 글상자 추가'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              메모 텍스트 (줄바꿈 가능)
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-['Jua'] leading-relaxed"
              placeholder="악보에 적을 연주 큐나 메모를 입력하세요 (예: 피아노 인트로 후 2절)"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">자주 쓰는 메모 예시</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SNIPPETS.map((snippet) => (
                <button
                  type="button"
                  key={snippet}
                  onClick={() => setText(snippet)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  {snippet}
                </button>
              ))}
            </div>
          </div>

          {/* 글씨체 5개 선택 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>글씨체 선택 (5종)</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">* 선택 시 다음에도 자동 유지</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {FONT_OPTIONS.map((f) => {
                const isSelected = fontFamily === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => handleSelectFont(f.id)}
                    className={`py-1.5 px-1 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight" style={{ fontFamily: f.family }}>
                      {f.id}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate max-w-full">
                      {f.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 색상 및 글자 크기 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-blue-500" />
                  글자 색상
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_TEXT_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() => setColor(c.color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      color.toLowerCase() === c.color.toLowerCase() ? 'scale-115 border-slate-900 dark:border-white shadow-sm' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                글씨 크기 ({fontSize}px)
              </label>
              <input
                type="range"
                min="18"
                max="48"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          {/* 실시간 미리보기 */}
          <div className="pt-2">
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">악보 위 실제 표시 미리보기</label>
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center min-h-[70px]">
              <span
                style={{
                  color,
                  fontSize: `${fontSize}px`,
                  fontFamily: FONT_OPTIONS.find((f) => f.id === fontFamily)?.family || 'Jua, sans-serif',
                }}
                className="font-bold whitespace-pre-wrap text-center"
              >
                {text || '메모 미리보기'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-center">
              * 글씨가 길어지면 글상자 크기가 글씨에 맞춰 자동으로 확장됩니다.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors shadow-md flex items-center gap-1.5"
            >
              <Type className="w-3.5 h-3.5" />
              {initialTextBox ? '수정 완료' : '글상자 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
