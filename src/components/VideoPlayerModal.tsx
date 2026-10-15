import React, { useState, useEffect, useRef } from 'react';
import { X, Maximize, Minimize, Download, RefreshCw, CheckCircle2, AlertCircle, Youtube, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSheetStore } from '../store/useSheetStore';

function getYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export const VideoPlayerModal: React.FC = () => {
  const { isVideoPlayerOpen, videoPlayingSheet, closeVideoPlayer, downloadSheetVideo } = useSheetStore();

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isVideoPlayerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeVideoPlayer();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoPlayerOpen]);

  // 마우스 비활성 시 2.5초 후 컨트롤 자동 숨김
  useEffect(() => {
    if (!isVideoPlayerOpen) return;

    const resetTimer = () => {
      setShowControls(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    };

    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVideoPlayerOpen]);

  if (!isVideoPlayerOpen || !videoPlayingSheet) return null;

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

  const handleOpenExternal = () => {
    if (!videoPlayingSheet.videoUrl) return;
    const api = (window as any).electronAPI;
    if (api && api.openExternal) {
      api.openExternal(videoPlayingSheet.videoUrl);
    } else {
      window.open(videoPlayingSheet.videoUrl, '_blank');
    }
  };

  const videoId = getYoutubeVideoId(videoPlayingSheet.videoUrl);
  const hasLocalVideo = Boolean(
    videoPlayingSheet.localVideoPath && videoPlayingSheet.videoDownloadStatus === 'completed'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden cursor-default">
      {/* 1. 상단 플로팅 컨트롤 바 (마우스 움직임 감지 시 부드럽게 노출) */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-5 inset-x-8 z-30 flex items-center justify-between pointer-events-none"
          >
            {/* 좌측 악보 및 영상 정보 */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md pointer-events-auto">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    {videoPlayingSheet.title} - 원곡 영상
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {videoPlayingSheet.currentKey} Key
                  </span>
                </div>

                {/* 다운로드 및 재생 상태 표시 */}
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  {hasLocalVideo ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      고화질 로컬 파일 재생 중
                    </span>
                  ) : videoPlayingSheet.videoDownloadStatus === 'downloading' ? (
                    <span className="text-amber-400 flex items-center gap-1.5 text-[11px] font-bold">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      로컬 영상 다운로드 중 ({videoPlayingSheet.videoDownloadProgress || 0}%)
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      온라인 스트리밍 재생 중
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 우측 액션 버튼들 */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* 다운로드 수동 트리거 버튼 (미다운로드 시) */}
              {!hasLocalVideo && videoPlayingSheet.videoDownloadStatus !== 'downloading' && (
                <button
                  onClick={() => downloadSheetVideo(videoPlayingSheet.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl backdrop-blur-md text-xs font-bold transition-colors"
                  title="원곡 영상을 로컬 PC에 4K/고화질로 영구 다운로드합니다"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>영상 다운로드</span>
                </button>
              )}

              {/* 외부 브라우저에서 열기 */}
              <button
                onClick={handleOpenExternal}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                title="웹 브라우저로 유튜브에서 직접 열기"
              >
                <ExternalLink className="w-5 h-5" />
              </button>

              {/* 전체화면 토글 */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                title="전체화면 토글 (단축키: F)"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>

              {/* 닫기 버튼 */}
              <button
                onClick={closeVideoPlayer}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-800 shadow-xl backdrop-blur-md transition-colors"
                title="원곡 영상 종료 (단축키: ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 메인 비디오 렌더링 영역 */}
      <div className="relative w-full h-full flex items-center justify-center bg-black">
        {hasLocalVideo && videoPlayingSheet.localVideoPath ? (
          /* 로컬 고화질 mp4 재생 */
          <video
            ref={videoRef}
            src={videoPlayingSheet.localVideoPath}
            controls
            autoPlay
            className="w-full h-full object-contain max-h-screen"
          />
        ) : videoId ? (
          /* 유튜브 IFrame 스트리밍 재생 (다운로드 완료 시 로컬 재생으로 자동 전환) */
          <div className="relative w-full h-full flex items-center justify-center">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com&rel=0&modestbranding=1`}
              title={videoPlayingSheet.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
            {/* 다운로드 진행 중 안내 배너 (마우스 오버나 활성 시 아래에 은은하게 노출) */}
            {videoPlayingSheet.videoDownloadStatus === 'downloading' && (
              <div className="absolute bottom-6 bg-slate-900/90 border border-amber-500/40 rounded-xl px-4 py-2 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs text-amber-300 pointer-events-none">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>
                  고화질 로컬 영상 다운로드 중 ({videoPlayingSheet.videoDownloadProgress || 0}%)... 완료 즉시 로컬 재생으로 전환됩니다.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-slate-400 space-y-2">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm font-bold text-slate-200">등록된 유튜브 영상 링크가 올바르지 않습니다.</p>
            <p className="text-xs text-slate-500">콘티 링크 업로드에서 올바른 YouTube URL을 지정해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
