import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw, Server, Cpu, Key, Globe, Info } from 'lucide-react';
import { useSheetStore } from '../store/useSheetStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { apiConfig, setApiConfig } = useSheetStore();

  const [baseUrl, setBaseUrl] = useState(apiConfig.baseUrl);
  const [endpoint, setEndpoint] = useState(apiConfig.endpoint);
  const [apiKey, setApiKey] = useState(apiConfig.apiKey);
  const [model, setModel] = useState(apiConfig.model);
  const [useMock, setUseMock] = useState(apiConfig.useMock);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    setApiConfig({
      baseUrl,
      endpoint,
      apiKey,
      model,
      useMock,
    });
    onClose();
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('AI 서버 통신 확인 중...');

    try {
      if (useMock) {
        setTestStatus('success');
        setTestMessage('스마트 시뮬레이션 모드 활성화됨 (오프라인 모의 분석 준비 완료)');
        return;
      }

      const isGoogleGemini = apiKey.startsWith('AIza') || endpoint.includes('generativelanguage.googleapis.com');

      if (isGoogleGemini) {
        // Direct Google Gemini API 테스트
        const modelName = model?.startsWith('gemini') ? model : 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'OK라고만 답변해주세요.' }] }],
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(`HTTP ${res.status}: ${errJson.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '응답 수신 완료';
        setTestStatus('success');
        setTestMessage(`Google Gemini 직접 연동 성공! 응답: "${reply.trim()}"`);
      } else {
        // Bridge Server 테스트 (localhost일 경우 프록시 적용)
        let targetEndpoint = endpoint;
        if (typeof window !== 'undefined') {
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocal && targetEndpoint.includes('debian.tailfdf16c.ts.net')) {
            targetEndpoint = targetEndpoint.replace('https://debian.tailfdf16c.ts.net', '/bridge-api');
          }
        }

        const res = await fetch(targetEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey || 'dummy-key'}`,
          },
          body: JSON.stringify({
            model: model === 'gemini-3.1-pro' ? 'gemini-3.5-flash' : (model || 'gemini-3.5-flash'),
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
        setTestMessage(`브릿지 서버 연동 성공! 응답: "${reply.trim().slice(0, 50)}"`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(`연결 실패: ${err.message || '서버에 도달할 수 없습니다'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden select-none transition-colors duration-200">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 font-['Jua'] tracking-wide">
              AI 분석 & 브릿지 서버 설정
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 본문 */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              AI 분석 연동 모드 안내
            </p>
            <p className="text-[11px] leading-relaxed opacity-90">
              • <b>브릿지 서버</b>: Tailscale Funnel 맥미니 Hermes 직통 라우팅 (데스크톱 및 로컬 프록시 지원)<br />
              • <b>Google Gemini API</b>: API Key(AIza...) 입력 시 웹 브라우저에서 CORS 제약 없이 즉시 고속 분석
            </p>
          </div>

          {/* 모의 모드 토글 */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/50">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-zinc-200">스마트 시뮬레이션 모드</p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
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
              <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Chat Completion Endpoint */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              채팅 엔드포인트 URL
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
              placeholder="https://debian.tailfdf16c.ts.net/v1/chat/completions"
            />
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              모델 (Model)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="gemini-3.1-pro">gemini-3.1-pro (고정밀 음악 분석)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (빠른 처리)</option>
              <option value="gemini-3.7-flash-lite">gemini-3.7-flash-lite</option>
            </select>
          </div>

          {/* Authorization Bearer Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              API Key (Authorization Bearer 또는 Google Gemini Key)
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
              placeholder="dummy-key (브릿지 서버) 또는 AIzaSy... (Gemini 직접 연동)"
            />
          </div>

          {/* 테스트 상태 표시 */}
          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                testStatus === 'testing'
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
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
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-zinc-950/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>서버 연결 테스트</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              취소
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
