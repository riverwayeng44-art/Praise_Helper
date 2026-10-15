import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw, Server, Cpu, Key, Globe, Type, Check } from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APP_FONT_OPTIONS = [
  { 
    id: 'Jua', 
    name: 'Jua (찬양팀 기본)', 
    family: "'Jua', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
    desc: '동글동글하고 친근한 찬양팀 전용 대표 서체' 
  },
  { 
    id: 'Dotum', 
    name: '돋움 (깔끔한 고딕)', 
    family: "'Dotum', '돋움', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", 
    desc: '인쇄 악보와 가장 잘 어울리는 깔끔하고 정갈한 고딕 서체' 
  },
  { 
    id: 'Gungsuh', 
    name: '궁서 (전통 서체)', 
    family: "'Gungsuh', '궁서', 'Batang', serif", 
    desc: '경건하고 엄숙한 예배 분위기의 붓글씨 명조체' 
  },
  { 
    id: 'Myeongjo', 
    name: '바른명조 (우아한 명조)', 
    family: "'Nanum Myeongjo', '바른명조', 'Batang', serif", 
    desc: '클래식하고 가독성이 뛰어난 우아한 명조체' 
  },
  { 
    id: 'Round', 
    name: '나눔스퀘어 (현대적 라운드)', 
    family: "'NanumSquareRound', 'NanumSquare', '맑은 고딕', sans-serif", 
    desc: '현대적이고 부드러운 산세리프 모던 서체' 
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { apiConfig, setApiConfig } = useSheetStore();

  const [activeTab, setActiveTab] = useState<'server' | 'font'>('server');

  // 서버 설정 상태
  const [baseUrl, setBaseUrl] = useState(apiConfig.baseUrl);
  const [endpoint, setEndpoint] = useState(apiConfig.endpoint);
  const [apiKey, setApiKey] = useState(apiConfig.apiKey);
  const [model, setModel] = useState(apiConfig.model);
  const [useMock, setUseMock] = useState(apiConfig.useMock);

  // 글꼴 설정 상태
  const [selectedFontId, setSelectedFontId] = useState(
    () => localStorage.getItem('praise_app_font_id') || 'Jua'
  );

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  if (!isOpen) return null;

  const handleApplyFont = (fontId: string) => {
    setSelectedFontId(fontId);
    const chosen = APP_FONT_OPTIONS.find((f) => f.id === fontId) || APP_FONT_OPTIONS[0];
    localStorage.setItem('praise_app_font_id', chosen.id);
    localStorage.setItem('praise_app_font_family', chosen.family);
    document.documentElement.style.setProperty('--app-font', chosen.family);
    document.body.style.fontFamily = chosen.family;
  };

  const handleSave = () => {
    // 1. 서버 설정 저장
    setApiConfig({
      baseUrl,
      endpoint,
      apiKey,
      model,
      useMock,
    });

    // 2. 글꼴 설정 저장
    const chosen = APP_FONT_OPTIONS.find((f) => f.id === selectedFontId) || APP_FONT_OPTIONS[0];
    localStorage.setItem('praise_app_font_id', chosen.id);
    localStorage.setItem('praise_app_font_family', chosen.family);
    document.documentElement.style.setProperty('--app-font', chosen.family);
    document.body.style.fontFamily = chosen.family;

    onClose();
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('브릿지 서버 통신 확인 중...');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey || 'dummy-key'}`,
        },
        body: JSON.stringify({
          model: model || 'gemini-3.1-pro',
          messages: [
            {
              role: 'user',
              content: '연결 테스트입니다. OK라고만 답해주세요.',
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '응답 수신 완료';
      setTestStatus('success');
      setTestMessage(`연결 성공! 응답: "${reply.trim()}"`);
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(`연결 실패: ${err.message || '서버에 도달할 수 없습니다'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200 flex flex-col max-h-[90vh]">
        {/* 헤더 및 탭 네비게이션 */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>환경 설정</span>
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 탭 버튼 2종 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('server')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'server'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>AI & 브릿지 서버</span>
            </button>

            <button
              onClick={() => setActiveTab('font')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'font'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>전체 프로그램 글꼴 (5종)</span>
            </button>
          </div>
        </div>

        {/* 탭 본문 영역 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'server' ? (
            <>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                Tailscale Funnel 외부 브릿지 서버(Port 8000/8888)를 통한 Gemini OpenAI 호환 API 연동 규격을 완벽 지원합니다.
              </div>

              {/* 모의 모드 토글 */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-200">스마트 시뮬레이션 모드</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    외부 네트워크 없이 로컬에서 즉시 코드 및 세션 가이드를 생성합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMock}
                    onChange={(e) => setUseMock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Chat Completion Endpoint */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  채팅 엔드포인트 URL
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="https://debian.tailfdf16c.ts.net/v1/chat/completions"
                />
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  모델 (Model)
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="gemini-3.1-pro">gemini-3.1-pro (고정밀 음악 분석)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (빠른 처리)</option>
                  <option value="gemini-3.7-flash-lite">gemini-3.7-flash-lite</option>
                </select>
              </div>

              {/* Authorization Bearer Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  API Key (Authorization Bearer)
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="dummy-key (브릿지 서버 내부 자동 주입)"
                />
              </div>

              {/* 테스트 상태 표시 */}
              {testStatus !== 'idle' && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    testStatus === 'testing'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : testStatus === 'success'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                  }`}
                >
                  {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
                  {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />}
                  <span className="truncate">{testMessage}</span>
                </div>
              )}
            </>
          ) : (
            /* 글꼴 설정 탭 */
            <div className="space-y-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                선택하신 대표 글꼴이 메인 화면, 메뉴, 버튼, 슬라이드 안내 텍스트 등 프로그램 전체에 일괄 적용됩니다.
              </div>

              <div className="space-y-2.5">
                {APP_FONT_OPTIONS.map((f) => {
                  const isSelected = selectedFontId === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => handleApplyFont(f.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-base font-bold text-slate-900 dark:text-slate-100"
                            style={{ fontFamily: f.family }}
                          >
                            {f.name}
                          </span>
                          {f.id === 'Jua' && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                              기본값
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {f.desc}
                        </p>
                        <p 
                          className="text-sm text-slate-700 dark:text-slate-300 pt-1"
                          style={{ fontFamily: f.family }}
                        >
                          예시: 원곡 A Key에서 +2 반음 전조 · 주를 기억하라
                        </p>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {activeTab === 'server' ? (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>서버 연결 테스트</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              클릭 시 즉시 프로그램 글씨체가 변경됩니다.
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20"
            >
              저장 및 적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
