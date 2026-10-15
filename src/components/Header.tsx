import React from 'react';
import { 
  Music, 
  Presentation, 
  Sun, 
  Moon, 
  Settings, 
  Save, 
  CheckCircle2,
  Youtube
} from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { 
    sheets, 
    startSlideShow, 
    theme, 
    setTheme, 
    autoSaveMessage,
    isDirty,
    saveToStorage
  } = useSheetStore();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 flex items-center justify-between select-none shadow-sm transition-colors duration-200">
      {/* 로고 및 프로그램 타이틀 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
          <Music className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white drop-shadow-sm">
              찬양팀 콘티 도우미
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-medium border border-emerald-500/30">
              Praise Helper v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            무손실 키 체인지 · 세션 가이드 하이라이트 · 연주자 풀스크린 슬라이드
          </p>
        </div>
      </div>

      {/* 액션 버튼 그룹 */}
      <div className="flex items-center gap-2.5">
        {/* 1분 자동 저장 상태 인디케이터 배지 & 수동 저장 버튼 */}
        <button
          onClick={() => saveToStorage()}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
            isDirty
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
          }`}
          title="1분 주기 자동 감지 저장 및 클릭 시 즉시 수동 저장"
        >
          {isDirty ? (
            <Save className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className="font-medium text-[11px] tracking-wide">{autoSaveMessage}</span>
        </button>

        {/* 콘티 링크 업로드 버튼 (푸른 하늘색 UI) */}
        <button
          onClick={() => useSheetStore.getState().setIsSetlistModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 hover:border-sky-500 shadow-sm active:scale-95 transition-all"
          title="유튜브 링크 및 콘티 텍스트를 입력하여 각 악보에 원곡 영상을 배정하고 다운로드합니다"
        >
          <Youtube className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span>콘티 링크 업로드</span>
        </button>

        {/* 연주자용 풀스크린 슬라이드 쇼 (PPT 모드) 버튼 */}
        <button
          onClick={() => startSlideShow()}
          disabled={sheets.length === 0}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all shadow-md ${
            sheets.length > 0
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-50'
          }`}
          title={sheets.length > 0 ? "연주자용 전체화면 슬라이드 쇼 실행 (F11/방향키)" : "악보를 먼저 등록해주세요"}
        >
          <Presentation className="w-4 h-4" />
          <span>PPT 슬라이드 쇼</span>
          {sheets.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-black/10 dark:bg-black/20 text-slate-900 tracking-wide">
              {sheets.length}곡
            </span>
          )}
        </button>

        {/* 다크/라이트 테마 전환 버튼 */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          title={theme === 'dark' ? "밝은 라이트 테마로 변경" : "어두운 다크 테마로 변경"}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
        </button>

        {/* AI 서버 설정 버튼 */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          title="Gemini AI 브릿지 서버 연동 설정"
        >
          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>
    </header>
  );
};
