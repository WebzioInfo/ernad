import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Download, Copy, RefreshCw, Server, Wifi, Smartphone, HardDrive, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticsPage() {
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === 'admin123') {
      setIsUnlocked(true);
      runDiagnostics();
    } else {
      toast.error('Invalid PIN');
    }
  };

  const measureFetch = async (url: string, options?: RequestInit) => {
    const start = performance.now();
    try {
      const res = await fetch(url, options);
      let data = null;
      if (options?.headers && (options.headers as any)['Content-Type'] === 'application/json') {
        try { data = await res.json(); } catch (e) { }
      } else if (url.includes('api.ipify.org')) {
        try { data = await res.json(); } catch (e) { }
      }
      return {
        success: res.ok || res.type === 'opaque',
        time: Math.round(performance.now() - start),
        status: res.status,
        statusText: res.statusText,
        data
      };
    } catch (err: any) {
      return {
        success: false,
        time: Math.round(performance.now() - start),
        error: {
          name: err.name,
          message: err.message,
          onLine: navigator.onLine
        }
      };
    }
  };

  const runDiagnostics = async () => {
    setIsGenerating(true);
    setReport(null);

    const diagReport: any = {
      timestamp: new Date().toISOString(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: (navigator as any).platform || 'unknown',
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      },
      connectivity: {},
      apiTest: {},
      authTest: {},
      serviceWorker: {},
      cacheAudit: {},
      envVars: {
        currentFrontendUrl: window.location.origin,
        configuredApiUrl: import.meta.env.VITE_API_URL || 'Not Set',
      }
    };

    // 1. IP Test
    diagReport.publicIp = await measureFetch('https://api.ipify.org?format=json');

    // 2. Railway Diagnostics
    diagReport.connectivity.railwayRoot = await measureFetch('https://ernad-production.up.railway.app', { mode: 'no-cors' });
    diagReport.connectivity.railwayHealth = await measureFetch('https://eranadapi.webziointernational.in/api/health');
    diagReport.connectivity.dnsResolution = await measureFetch('https://ernad-production.up.railway.app/favicon.ico', { mode: 'no-cors' });
    diagReport.connectivity.vercel = await measureFetch('https://ernad.vercel.app', { mode: 'no-cors' });

    // 3. Auth Test
    const authRes = await measureFetch('https://eranadapi.webziointernational.in/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'test', credential: 'test', type: 'PIN' })
    });

    // Rejection 401 means API is reachable and logic is working
    diagReport.authTest.login = {
      success: authRes.success || authRes.status === 401,
      time: authRes.time,
      status: authRes.status,
      error: authRes.error
    };

    // 4. Service Worker
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        diagReport.serviceWorker = {
          supported: true,
          registeredCount: regs.length,
          activeScripts: regs.map(r => r.active?.scriptURL).filter(Boolean)
        };
      } else {
        diagReport.serviceWorker = { supported: false };
      }
    } catch (e: any) {
      diagReport.serviceWorker = { error: e.message };
    }

    // 5. Cache Audit
    try {
      diagReport.cacheAudit.localStorageKeys = Object.keys(localStorage);
      diagReport.cacheAudit.sessionStorageKeys = Object.keys(sessionStorage);
      if ('caches' in window) {
        diagReport.cacheAudit.cacheNames = await caches.keys();
      }
    } catch (e: any) {
      diagReport.cacheAudit.error = e.message;
    }

    setReport(diagReport);
    setIsGenerating(false);

    // Try to send report to backend
    try {
      await axios.post('https://eranadapi.webziointernational.in/api/diagnostics/report', diagReport, {
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('Diagnostics sent to server');
    } catch (e) {
      // Ignore if it fails
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleUnlock} className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white text-center mb-2">Diagnostics Override</h1>
          <p className="text-slate-400 text-sm text-center mb-6">Enter Admin PIN to run network diagnostics.</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center tracking-[0.5em] text-xl focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none mb-4"
            placeholder="****"
            autoFocus
          />
          <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2">
            <Lock className="w-4 h-4" /> Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-800">System Diagnostics</h1>
            <p className="text-slate-500 text-sm">Offline-capable connectivity analysis</p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={isGenerating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            Rerun Tests
          </button>
        </div>

        {isGenerating && !report && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-slate-700">Running Audits...</h2>
            <p className="text-slate-500 text-sm mt-1">Please wait while we collect telemetry data.</p>
          </div>
        )}

        {report && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-bold flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2"><Smartphone className="w-5 h-5 text-indigo-500" /> Device Info</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">OS/Platform:</span> <span className="font-mono font-medium">{report.deviceInfo.platform}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Language:</span> <span className="font-mono font-medium">{report.deviceInfo.language}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Timezone:</span> <span className="font-mono font-medium truncate max-w-[200px]">{report.deviceInfo.timeZone}</span></div>
                <div className="mt-2 text-xs text-slate-400 font-mono break-all bg-slate-50 p-2 rounded">{report.deviceInfo.userAgent}</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-bold flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2"><Wifi className="w-5 h-5 text-emerald-500" /> Connectivity</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Railway Root</span>
                  {report.connectivity.railwayRoot?.success ? <span className="text-emerald-600 font-bold">{report.connectivity.railwayRoot.time}ms</span> : <span className="text-rose-500 font-bold text-xs max-w-[150px] truncate" title={report.connectivity.railwayRoot?.error?.message}>FAIL</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Railway API Health</span>
                  {report.connectivity.railwayHealth?.success ? <span className="text-emerald-600 font-bold">{report.connectivity.railwayHealth.time}ms</span> : <span className="text-rose-500 font-bold text-xs max-w-[150px] truncate" title={report.connectivity.railwayHealth?.error?.message}>FAIL</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Railway DNS (favicon)</span>
                  {report.connectivity.dnsResolution?.success ? <span className="text-emerald-600 font-bold">{report.connectivity.dnsResolution.time}ms</span> : <span className="text-rose-500 font-bold text-xs max-w-[150px] truncate" title={report.connectivity.dnsResolution?.error?.message}>FAIL</span>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Frontend Vercel</span>
                  {report.connectivity.vercel?.success ? <span className="text-emerald-600 font-bold">{report.connectivity.vercel.time}ms</span> : <span className="text-rose-500 font-bold text-xs max-w-[150px] truncate" title={report.connectivity.vercel?.error?.message}>FAIL</span>}
                </div>
                <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
                  <span className="text-slate-500">Public IP</span>
                  <span className="font-mono font-medium text-slate-700">{report.publicIp?.data?.ip || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-bold flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2"><HardDrive className="w-5 h-5 text-amber-500" /> Caching & Storage</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Service Worker:</span> <span className="font-mono font-medium">{report.serviceWorker.registeredCount > 0 ? 'Active' : 'None'}</span></div>
                {report.serviceWorker.activeScripts && report.serviceWorker.activeScripts.map((url: string, i: number) => (
                  <div key={i} className="text-xs text-slate-400 font-mono break-all">{url}</div>
                ))}
                <div className="flex justify-between mt-2"><span className="text-slate-500">Cache Names:</span> <span className="font-mono font-medium">{report.cacheAudit.cacheNames?.length || 0}</span></div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {report.cacheAudit.cacheNames?.map((c: string) => <span key={c} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">{c}</span>)}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-bold flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-2"><Server className="w-5 h-5 text-purple-500" /> Environment</h2>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col"><span className="text-slate-500 text-xs">Origin</span> <span className="font-mono text-slate-700">{report.envVars.currentFrontendUrl}</span></div>
                <div className="flex flex-col"><span className="text-slate-500 text-xs">VITE_API_URL</span> <span className="font-mono text-slate-700 break-all">{report.envVars.configuredApiUrl}</span></div>
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-900 rounded-2xl p-6 text-slate-300 relative overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(JSON.stringify(report, null, 2)); toast.success('Copied!'); }}
                  className="p-2 hover:bg-slate-800 rounded-lg transition" title="Copy JSON"
                ><Copy className="w-4 h-4" /></button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ernad-diag-${Date.now()}.json`;
                    a.click();
                  }}
                  className="p-2 hover:bg-slate-800 rounded-lg transition text-indigo-400" title="Download JSON"
                ><Download className="w-4 h-4" /></button>
              </div>
              <h2 className="font-bold text-white mb-4">Raw Report</h2>
              <pre className="text-xs font-mono overflow-auto max-h-64 scrollbar-thin">
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
