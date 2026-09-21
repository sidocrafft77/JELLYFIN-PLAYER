import React from 'react';
import { Home, Tv, FolderTree, HardDrive, Clock, Server } from 'lucide-react';
import { JellyfinServerConfig } from '../types';

export type ActiveFilterTab = 'all' | 'movies' | 'folders' | 'offline' | 'history';

interface MobileBottomNavProps {
  activeTab: ActiveFilterTab;
  onTabChange: (tab: ActiveFilterTab) => void;
  cachedCount: number;
  serverConfig: JellyfinServerConfig;
  onOpenConnectModal: () => void;
  onGoHome?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  cachedCount,
  serverConfig,
  onOpenConnectModal,
  onGoHome,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/80 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--app-header-bg, rgba(10, 10, 10, 0.95))',
        borderColor: 'var(--app-border, #262626)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="grid grid-cols-6 items-center px-1 pt-2">
        {/* 1. Home */}
        <button
          id="mobile-nav-home"
          type="button"
          onClick={() => {
            onTabChange('all');
            if (onGoHome) onGoHome();
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] ${
            activeTab === 'all'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          style={{
            color: activeTab === 'all' ? 'var(--app-accent, #6366f1)' : 'var(--app-text-muted, #a3a3a3)',
          }}
          aria-current={activeTab === 'all' ? 'page' : undefined}
          title="Return to Home"
        >
          <div className="relative">
            <Home className="w-5 h-5" />
            {activeTab === 'all' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">Home</span>
        </button>

        {/* 2. Movies */}
        <button
          id="mobile-nav-movies"
          type="button"
          onClick={() => onTabChange('movies')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] ${
            activeTab === 'movies'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          style={{
            color: activeTab === 'movies' ? 'var(--app-accent, #6366f1)' : 'var(--app-text-muted, #a3a3a3)',
          }}
          aria-current={activeTab === 'movies' ? 'page' : undefined}
        >
          <div className="relative">
            <Tv className="w-5 h-5" />
            {activeTab === 'movies' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">Movies</span>
        </button>

        {/* 3. Server Folders */}
        <button
          id="mobile-nav-folders"
          type="button"
          onClick={() => onTabChange('folders')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] ${
            activeTab === 'folders'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          style={{
            color: activeTab === 'folders' ? 'var(--app-accent, #6366f1)' : 'var(--app-text-muted, #a3a3a3)',
          }}
          aria-current={activeTab === 'folders' ? 'page' : undefined}
        >
          <div className="relative">
            <FolderTree className="w-5 h-5" />
            {activeTab === 'folders' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">Folders</span>
        </button>

        {/* 4. Offline Downloads */}
        <button
          id="mobile-nav-offline"
          type="button"
          onClick={() => onTabChange('offline')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] ${
            activeTab === 'offline'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          style={{
            color: activeTab === 'offline' ? 'var(--app-accent, #6366f1)' : 'var(--app-text-muted, #a3a3a3)',
          }}
          aria-current={activeTab === 'offline' ? 'page' : undefined}
        >
          <div className="relative">
            <HardDrive className="w-5 h-5" />
            {cachedCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {cachedCount}
              </span>
            )}
            {activeTab === 'offline' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">Offline</span>
        </button>

        {/* 5. Watch History */}
        <button
          id="mobile-nav-history"
          type="button"
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] ${
            activeTab === 'history'
              ? 'text-indigo-400 font-bold scale-105'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
          style={{
            color: activeTab === 'history' ? 'var(--app-accent, #6366f1)' : 'var(--app-text-muted, #a3a3a3)',
          }}
          aria-current={activeTab === 'history' ? 'page' : undefined}
        >
          <div className="relative">
            <Clock className="w-5 h-5" />
            {activeTab === 'history' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">History</span>
        </button>

        {/* 6. Server Connection Switcher */}
        <button
          id="mobile-nav-server"
          type="button"
          onClick={onOpenConnectModal}
          className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition cursor-pointer min-h-[44px] text-neutral-400 hover:text-neutral-200"
          style={{
            color: 'var(--app-text-muted, #a3a3a3)',
          }}
          title={serverConfig.isDemoMode ? 'Demo Library active' : `Connected to ${serverConfig.serverName || 'Jellyfin'}`}
        >
          <div className="relative">
            <Server className="w-5 h-5" />
            <span
              className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full border border-neutral-950 ${
                serverConfig.isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
            {serverConfig.isDemoMode ? 'Demo' : 'Server'}
          </span>
        </button>
      </div>
    </nav>
  );
};
