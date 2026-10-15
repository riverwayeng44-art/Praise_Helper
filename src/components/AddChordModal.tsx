import React, { useState } from 'react';
import { X, Hash } from 'lucide-react';
import { ChordItem } from '../types';

interface AddChordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChord: (chord: Omit<ChordItem, 'id'>) => void;
  initialBox?: { x: number; y: number; width: number; height: number };
}

export const AddChordModal: React.FC<AddChordModalProps> = ({
  isOpen,
  onClose,
  onAddChord,
  initialBox,
}) => {
  const [chordText, setChordText] = useState('G');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chordText.trim()) return;

    onAddChord({
      chordText: chordText.trim(),
      box: initialBox || { x: 100, y: 100, width: 60, height: 35 },
    });
    setChordText('');
    onClose();
  };

  const quickChords = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Em', 'Am', 'Dm', 'Bm', 'F#m', 'D/F#', 'G/B', 'Cadd9', 'Dsus4'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden select-none transition-colors duration-200">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">코드 수동 추가</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              코드 텍스트 (예: G, D/F#, Em7, Cadd9)
            </label>
            <input
              type="text"
              value={chordText}
              onChange={(e) => setChordText(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-bold"
              placeholder="G"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">빠른 코드 선택</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {quickChords.map((qc) => (
                <button
                  type="button"
                  key={qc}
                  onClick={() => setChordText(qc)}
                  className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-mono transition-colors"
                >
                  {qc}
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
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md"
            >
              추가 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
