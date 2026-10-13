import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { QueueSidebar } from './components/QueueSidebar';
import { EditorView } from './components/EditorView';
import { SlideShowModal } from './components/SlideShowModal';
import { SettingsModal } from './components/SettingsModal';
import { useSheetStore } from './store/useSheetStore';
import { ensureFontLoaded } from './utils/canvasRenderer';

export const App: React.FC = () => {
  const { 
    initFromStorage, 
    addSampleSheet, 
    checkAndAutoSave, 
    saveToStorage, 
    theme 
  } = useSheetStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // 1. 폰트 준비
    ensureFontLoaded('Jua');

    // 2. 이전에 작업하던 악보 데이터 및 테마 복원 (영속성)
    const init = async () => {
      const hasRestored = await initFromStorage();
      // 이전에 저장된 악보가 하나도 없을 때만 초기 샘플 악보 1곡 준비
      if (!hasRestored) {
        await addSampleSheet();
      }
    };
    init();

    // 3. 1분(60초)마다 변경사항을 감지하여 자동 저장
    const timer = setInterval(() => {
      checkAndAutoSave();
    }, 60000);

    // 4. 창을 닫기 직전에도 최신 상태 안전 저장
    const handleBeforeUnload = () => {
      saveToStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans select-none transition-colors duration-200">
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* 2. 메인 워크스페이스 (좌측 큐 목록 + 중앙 고해상도 무손실 에디터) */}
      <div className="flex-1 flex overflow-hidden">
        <QueueSidebar />
        <EditorView />
      </div>

      {/* 3. 연주자용 풀스크린 슬라이드 쇼 (PPT 모드) */}
      <SlideShowModal />

      {/* 4. 브릿지 서버 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
