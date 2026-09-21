import React, { useState } from 'react';
import { JellyfinServerConfig } from '../types';
import { authenticateByName, cleanServerUrl, testJellyfinConnection } from '../services/jellyfinApi';
import { Server, CheckCircle2, AlertCircle, Loader2, X, Sparkles, LogOut } from 'lucide-react';

interface JellyfinConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: JellyfinServerConfig;
  onSaveConfig: (config: JellyfinServerConfig) => void;
  onSwitchToDemo: () => void;
}

export const JellyfinConnectModal: React.FC<JellyfinConnectModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveConfig,
  onSwitchToDemo,
}) => {
  const [serverUrl, setServerUrl] = useState(
    currentConfig.isDemoMode ? 'http://192.168.1.100:8096' : currentConfig.serverUrl || ''
  );
  const [username, setUsername] = useState(currentConfig.username || '');
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    serverName?: string;
    version?: string;
    error?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!serverUrl.trim()) {
      setErrorMsg('Please enter a server URL');
      return;
    }
    setErrorMsg(null);
    setIsTesting(true);
    setTestResult(null);

    const result = await testJellyfinConnection(serverUrl);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim()) {
      setErrorMsg('Server URL is required');
      return;
    }
    if (!username.trim()) {
      setErrorMsg('Username is required');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const result = await authenticateByName(serverUrl, username, password);
    setIsSubmitting(false);

    if (result.success && result.config) {
      onSaveConfig(result.config);
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to authenticate with Jellyfin server');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Jellyfin Server Connection</h2>
              <p className="text-xs text-neutral-400">Connect to your personal or remote Jellyfin media server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status banner */}
        {!currentConfig.isDemoMode && currentConfig.accessToken && (
          <div className="px-6 py-3 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Connected to: <strong>{currentConfig.serverName || currentConfig.serverUrl}</strong> ({currentConfig.username})</span>
            </div>
            <button
              onClick={() => {
                onSwitchToDemo();
                onClose();
              }}
              className="text-xs text-neutral-400 hover:text-rose-300 flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleConnect} className="p-6 space-y-4">
          
          {/* Server URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">
              Server URL or IP Address
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="https://jellyfin.example.com or http://192.168.1.100:8096"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !serverUrl.trim()}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-xs font-medium text-neutral-200 transition flex items-center space-x-1.5"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Test</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Tip: Enter your Jellyfin port (typically 8096) or reverse-proxy HTTPS domain.
            </p>
          </div>

          {/* Test Status feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Server reachable!</strong>
                    <span>{testResult.serverName} (v{testResult.version || 'unknown'})</span>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Connection failed:</strong>
                    <span>{testResult.error}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Username</label>
              <input
                type="text"
                placeholder="Jellyfin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Password</label>
              <input
                type="password"
                placeholder="Optional if no password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Connect & Browse Jellyfin</span>
            </button>
          </div>

        </form>

        {/* Demo Mode / Alternative Option */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Don't have an active server right now?
          </div>
          <button
            onClick={() => {
              onSwitchToDemo();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Use Sample Library</span>
          </button>
        </div>

      </div>
    </div>
  );
};
