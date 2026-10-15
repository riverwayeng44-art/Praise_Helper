import React, { useState } from 'react';
import { X, Link2, Sparkles, Youtube, Check, Download, AlertCircle, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';
import { analyzeSetlistTextWithAI, SetlistMatchResult } from '../services/aiService';

interface SetlistLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetlistLinkModal: React.FC<SetlistLinkModalProps> = ({ isOpen, onClose }) => {
  const { sheets, setSheetVideoUrl, updateSheetTitle, downloadAllVideos, setToastMessage, apiConfig } = useSheetStore();

  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResults, setMatchResults] = useState<{ [sheetId: string]: string }>({});
  const [matchedTitles, setMatchedTitles] = useState<{ [sheetId: string]: string }>({});
  const [allExtractedUrls, setAllExtractedUrls] = useState<{ url: string; title: string }[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [autoRenameTitle, setAutoRenameTitle] = useState(true);

  if (!isOpen) return null;

  // AI 분석 및 oEmbed 영상 제목 조회 실행
  const handleAnalyze = async () => {
    if (!rawText.trim()) {
      setToastMessage('⚠️ 콘티 내용 또는 유튜브 링크 텍스트를 입력해주세요.');
      return;
    }

    if (sheets.length === 0) {
      setToastMessage('⚠️ 먼저 악보를 1곡 이상 등록해주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const results: SetlistMatchResult[] = await analyzeSetlistTextWithAI(
        rawText,
        sheets.map((s) => ({ id: s.id, title: s.title, detectedKey: s.detectedKey })),
        apiConfig
      );

      const mapping: { [sheetId: string]: string } = {};
      const titlesMap: { [sheetId: string]: string } = {};
      const urlsList: { url: string; title: string }[] = [];

      sheets.forEach((s) => {
        if (s.videoUrl) mapping[s.id] = s.videoUrl;
      });

      results.forEach((r) => {
        if (r.sheetId && r.youtubeUrl) {
          mapping[r.sheetId] = r.youtubeUrl;
          if (r.detectedSongName) {
            titlesMap[r.sheetId] = r.detectedSongName;
          }
          if (!urlsList.some((u) => u.url === r.youtubeUrl)) {
            urlsList.push({
              url: r.youtubeUrl,
              title: r.videoTitle || r.detectedSongName || r.youtubeUrl,
            });
          }
        }
      });

      setMatchResults(mapping);
      setMatchedTitles(titlesMap);
      setAllExtractedUrls(urlsList);
      setHasAnalyzed(true);
      setToastMessage(`✨ 콘티 분석 및 영상 매칭 완료: ${results.length}곡 매칭되었습니다.`);
    } catch (err: any) {
      console.error('Failed to analyze setlist text:', err);
      setToastMessage('⚠️ 링크 분석 중 오류가 발생했습니다. 직접 링크를 입력해주세요.');
      setHasAnalyzed(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 링크 수동 변경
  const handleUrlChange = (sheetId: string, url: string) => {
    setMatchResults((prev) => ({
      ...prev,
      [sheetId]: url,
    }));
  };

  // 1번 ↔ 2번 링크 서로 맞바꾸기 (사용자 스왑 버튼)
  const handleSwapFirstTwo = () => {
    if (sheets.length < 2) return;
    const id1 = sheets[0].id;
    const id2 = sheets[1].id;
    const url1 = matchResults[id1] || sheets[0].videoUrl || '';
    const url2 = matchResults[id2] || sheets[1].videoUrl || '';

    setMatchResults((prev) => ({
      ...prev,
      [id1]: url2,
      [id2]: url1,
    }));

    const title1 = matchedTitles[id1] || '';
    const title2 = matchedTitles[id2] || '';
    setMatchedTitles((prev) => ({
      ...prev,
      [id1]: title2,
      [id2]: title1,
    }));

    setToastMessage('⇄ 1번과 2번 악보의 영상 링크가 서로 교체되었습니다.');
  };

  // 최종 적용 및 백그라운드 다운로드 시작
  const handleApply = async () => {
    let appliedCount = 0;
    for (const sheet of sheets) {
      const url = matchResults[sheet.id]?.trim();
      if (url) {
        await setSheetVideoUrl(sheet.id, url);
        appliedCount++;

        // 악보명이 파일명(IMG_...)이고 곡명이 감지되었을 경우 악보 제목 자동 갱신
        if (
          autoRenameTitle &&
          matchedTitles[sheet.id] &&
          (sheet.title.startsWith('IMG_') || sheet.title.startsWith('image') || sheet.title === sheet.fileName)
        ) {
          await updateSheetTitle(sheet.id, matchedTitles[sheet.id]);
        }
      }
    }

    onClose();
    if (appliedCount > 0) {
      setToastMessage(`🎬 ${appliedCount}곡의 원곡 영상 링크가 설정되었습니다. 백그라운드 영상 다운로드를 시작합니다.`);
      downloadAllVideos();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>콘티 링크 업로드 & 원곡 영상 자동 배정</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                유튜브 링크와 콘티 텍스트를 붙여넣으면 YouTube 실제 제목과 대조하여 알맞은 악보에 자동 매칭합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* 입력창 안내 및 텍스트 영역 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-sky-500" />
                콘티 텍스트 또는 유튜브 링크 목록 입력
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                곡명과 유튜브 링크가 적힌 카톡 공지나 메모를 그대로 붙여넣으세요
              </span>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`예시:\n10/18 콘티\n1. 주를 기억하라 https://youtu.be/...\n2. 꽃들도 https://www.youtube.com/watch?v=...`}
              rows={4}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
            />
          </div>

          {/* AI 분석 및 도구 바 */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200">현재 등록된 악보:</span> {sheets.length}곡
            </div>

            <div className="flex items-center gap-2">
              {sheets.length >= 2 && (
                <button
                  type="button"
                  onClick={handleSwapFirstTwo}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                  title="1번 악보와 2번 악보에 배정된 영상 링크를 서로 맞바꿉니다"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-sky-500" />
                  <span>⇄ 1번 ↔ 2번 링크 맞바꾸기</span>
                </button>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !rawText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? '유튜브 제목 조회 및 AI 대조 중...' : 'AI 링크 자동 매칭'}</span>
              </button>
            </div>
          </div>

          {/* 악보 제목 자동 갱신 옵션 */}
          <div className="flex items-center gap-2 px-1">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenameTitle}
                onChange={(e) => setAutoRenameTitle(e.target.checked)}
                className="rounded border-slate-300 text-sky-500 focus:ring-sky-400"
              />
              <span>악보명이 파일명(IMG_...)인 경우, 영상의 실제 찬양 곡명으로 악보 제목 자동 변경</span>
            </label>
          </div>

          {/* 악보별 매칭 결과 목록 */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center justify-between">
              <span>악보별 원곡 유튜브 영상 링크 ({sheets.length}곡)</span>
              {hasAnalyzed && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                  ✓ 매칭 완료 (수동 변경 및 링크 선택 가능)
                </span>
              )}
            </h3>

            {sheets.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl">
                등록된 악보가 없습니다. 먼저 악보를 등록해주세요.
              </div>
            ) : (
              <div className="space-y-2">
                {sheets.map((sheet, idx) => {
                  const currentVal = matchResults[sheet.id] !== undefined ? matchResults[sheet.id] : (sheet.videoUrl || '');
                  const currentTitle = matchedTitles[sheet.id];
                  const hasUrl = Boolean(currentVal.trim());

                  return (
                    <div
                      key={sheet.id}
                      className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="w-40 flex-shrink-0 truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={sheet.title}>
                            {sheet.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {sheet.detectedKey} Key
                            </span>
                            {currentTitle && (
                              <span className="text-sky-600 dark:text-sky-400 truncate">
                                ➔ {currentTitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* URL 직접 입력창 */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => handleUrlChange(sheet.id, e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                          />
                        </div>

                        {/* 다른 감지된 링크 선택 드롭다운 (옵션) */}
                        {allExtractedUrls.length > 1 && (
                          <div className="flex-shrink-0">
                            <select
                              value={currentVal}
                              onChange={(e) => handleUrlChange(sheet.id, e.target.value)}
                              className="px-2 py-1.5 text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
                            >
                              <option value="">링크 선택...</option>
                              {allExtractedUrls.map((u, i) => (
                                <option key={i} value={u.url}>
                                  {i + 1}. {u.title.substring(0, 22)}...
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex-shrink-0">
                          {hasUrl ? (
                            <span className="text-[10px] px-2 py-1 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              배정됨
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              미배정
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-sky-500" />
            <span>적용 시 프로그램이 원곡 영상 및 음원을 자동 다운로드하여 저장합니다.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-md shadow-sky-500/20"
            >
              <Check className="w-4 h-4" />
              <span>콘티 링크 적용 & 다운로드 시작</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
