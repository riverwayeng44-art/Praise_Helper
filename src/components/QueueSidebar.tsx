import React, { useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  FileText, 
  Sparkles,
  Music2,
  Play,
  Youtube,
  Download,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';
import { getSemitoneDiff } from '../utils/transposer';

export const QueueSidebar: React.FC = () => {
  const { 
    sheets, 
    activeSheetId, 
    setActiveSheetId, 
    removeSheet, 
    reorderSheets, 
    addSheetsFromFiles,
    openVideoPlayer,
    downloadSheetVideo,
    downloadAllVideos
  } = useSheetStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      addSheetsFromFiles(filesArray);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      addSheetsFromFiles(filesArray);
    }
  };

  return (
    <aside className="w-80 h-full bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 select-none transition-colors duration-200">
      {/* 큐 상단 타이틀 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide">찬양 콘티 큐 (순서)</h2>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 font-bold tracking-wide">
          {sheets.length}곡 등록됨
        </span>
      </div>

      {/* 업로드 드롭존 */}
      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80"
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              악보 이미지 드래그 또는 클릭
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              3~4장 묶음 다중 선택 (PNG, JPG, WEBP)
            </p>
          </div>
        </div>
      </div>

      {/* 악보 리스트 큐 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sheets.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-600 dark:text-slate-400">등록된 악보가 없습니다.</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              악보 이미지를 위 영역에 드래그하거나 클릭하여 추가하세요.
            </p>
          </div>
        ) : (
          sheets.map((sheet, index) => {
            const isActive = sheet.id === activeSheetId;
            const semiDiff = getSemitoneDiff(sheet.detectedKey, sheet.currentKey);

            return (
              <div
                key={sheet.id}
                onClick={() => setActiveSheetId(sheet.id)}
                className={`group relative rounded-xl border p-2.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50/50 dark:bg-slate-800 border-emerald-500/70 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* 순서 번호 */}
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* 썸네일 미리보기 */}
                  <div className="w-12 h-14 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    <img
                      src={sheet.transposedImageUrl || sheet.originalImageUrl}
                      alt={sheet.title}
                      className="w-full h-full object-cover object-top"
                    />
                    {sheet.isAnalyzing && (
                      <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* 악보 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {sheet.title}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {sheet.fileName}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Key 정보 배지 */}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold border border-slate-200 dark:border-slate-600">
                        {sheet.currentKey} Key
                      </span>
                      {semiDiff !== 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                          {semiDiff > 0 ? `+${semiDiff}` : semiDiff}
                        </span>
                      )}
                      {sheet.chords.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {sheet.chords.length}Chords
                        </span>
                      )}
                    </div>

                    {/* 원곡 영상 보기 버튼 (유튜브 링크 배정 시) */}
                    {sheet.videoUrl && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVideoPlayer(sheet);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${
                            sheet.videoDownloadStatus === 'completed'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/20'
                              : sheet.videoDownloadStatus === 'downloading'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="악보 원곡 영상을 전체화면으로 재생합니다 (ESC로 닫기)"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>원곡 영상 보기</span>
                          {sheet.videoDownloadStatus === 'downloading' && (
                            <span className="text-[9px] text-amber-500">
                              ({sheet.videoDownloadProgress || 0}%)
                            </span>
                          )}
                          {sheet.videoDownloadStatus === 'completed' && (
                            <span className="text-[9px] text-emerald-500">
                              (로컬)
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 순서 이동 & 삭제 버튼 */}
                  <div className="flex flex-col items-center gap-1 pl-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderSheets(index, index - 1);
                      }}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 disabled:hover:bg-transparent"
                      title="위로 이동"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sheets.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderSheets(index, index + 1);
                      }}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 disabled:hover:bg-transparent"
                      title="아래로 이동"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSheet(sheet.id);
                      }}
                      className="p-1 rounded hover:bg-red-500/10 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500"
                      title="콘티에서 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 좌측 하단: 원곡 영상 다운로드 센터 */}
      {sheets.some((s) => s.videoUrl) && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Youtube className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                원곡 영상 다운로드 센터
              </span>
            </div>
            {/* 완료 / 전체 개수 */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              {sheets.filter((s) => s.videoDownloadStatus === 'completed').length} /{' '}
              {sheets.filter((s) => Boolean(s.videoUrl)).length} 완료
            </span>
          </div>

          {/* 현재 다운로드 중인 곡의 실시간 게이지 바 */}
          {(() => {
            const currentDownloading = sheets.find((s) => s.videoDownloadStatus === 'downloading');
            if (currentDownloading) {
              const progress = currentDownloading.videoDownloadProgress || 0;
              return (
                <div className="bg-white dark:bg-slate-800/90 rounded-lg p-2.5 border border-amber-500/30 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px] flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 text-amber-500 animate-spin flex-shrink-0" />
                      <span className="truncate">{currentDownloading.title}</span>
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {progress}%
                    </span>
                  </div>
                  {/* 프로그레스 바 게이지 */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(6, progress)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    4K/고화질 다운로드 중... 완료 시 즉시 오프라인 재생
                  </p>
                </div>
              );
            }

            const uncompletedCount = sheets.filter(
              (s) => s.videoUrl && s.videoDownloadStatus !== 'completed'
            ).length;

            if (uncompletedCount === 0) {
              return (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>모든 원곡 영상 오프라인 준비 완료</span>
                </div>
              );
            }

            return (
              <button
                type="button"
                onClick={() => downloadAllVideos()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-all"
                title="등록된 유튜브 원곡 영상들을 PC 로컬에 고화질로 다운로드합니다"
              >
                <Download className="w-3.5 h-3.5" />
                <span>원곡 영상 {uncompletedCount}곡 전체 다운로드</span>
              </button>
            );
          })()}
        </div>
      )}

      {/* 하단 순서 편집 안내 */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-center">
        ▲/▼ 버튼으로 예배 흐름에 맞춰 순서를 정렬하세요.
      </div>
    </aside>
  );
};
