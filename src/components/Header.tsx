import React, { useState, useEffect, useRef } from 'react';
import { JellyfinServerConfig, ThemeMode } from '../types';
import { Home, HardDrive, Server, Search, Film, Sparkles, FolderPlus, User, X, Moon, Sun } from 'lucide-react';
import { formatBytes } from '../services/offlineStorage';

interface HeaderProps {
  serverConfig: JellyfinServerConfig;
  onOpenConnectModal: () => void;
  onOpenOfflineModal: () => void;
  onOpenDirectPlayModal: () => void;
  cachedCount: number;
  cachedTotalBytes: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serverConfig,
  onOpenConnectModal,
  onOpenOfflineModal,
  onOpenDirectPlayModal,
  cachedCount,
  cachedTotalBytes,
  searchQuery,
  onSearchChange,
  theme = 'night',
  onToggleTheme,
  onGoHome,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDelta = currentScrollY - lastScrollY;

          // Always display header when near the very top of the page
          if (currentScrollY <= 60) {
            setIsVisible(true);
          } else if (scrollDelta > 6 && currentScrollY > 80 && !mobileSearchOpen) {
            // Scrolling down past threshold -> hide header to maximize vertical browsing space
            setIsVisible(false);
          } else if (scrollDelta < -6) {
            // Scrolling up -> reveal header
            setIsVisible(true);
          }

          lastScrollY = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileSearchOpen]);

  const rawUsername = serverConfig.username?.trim();
  const displayName = rawUsername
    ? rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1)
    : serverConfig.isDemoMode
    ? 'Demo'
    : 'User';

  const shouldShow = isVisible || isSearchFocused || mobileSearchOpen;

  const handleToggleMobileSearch = () => {
    setMobileSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => mobileSearchInputRef.current?.focus(), 100);
      }
      return next;
    });
  };

  return (
    <header
      id="main-app-header"
      className={`sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800/80 px-3 sm:px-8 py-2.5 sm:py-3.5 transition-transform duration-300 ease-in-out will-change-transform ${
        shouldShow ? 'translate-y-0' : '-translate-y-full shadow-none pointer-events-none'
      }`}
      style={{
        backgroundColor: 'var(--app-header-bg, rgba(10, 10, 10, 0.95))',
        borderColor: 'var(--app-border, #262626)',
      }}
    >
      {/* Desktop / Tablet Header Layout */}
      <div className="hidden md:flex items-center justify-between gap-4">
        {/* Brand & Connection Status */}
        <div className="flex items-center space-x-4">
          <button
            id="header-brand-home-btn"
            type="button"
            onClick={onGoHome}
            className="flex items-center space-x-2.5 text-left group hover:opacity-95 transition cursor-pointer p-0.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            title="Return to Home"
            aria-label="Return to Home"
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <span
                id="header-app-title"
                className="text-base font-bold tracking-tight text-white flex flex-wrap items-center gap-2"
              >
                <span>Jellyfin Video Player</span>
                <span
                  id="header-user-greeting-badge"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal bg-neutral-900/90 text-neutral-300 border border-neutral-800 shadow-sm"
                >
                  <span
                    id="header-user-indicator"
                    className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0"
                    title={`Active Jellyfin session: ${displayName}`}
                  >
                    <User className="w-2.5 h-2.5" />
                  </span>
                  <span id="header-user-greeting-text" className="text-neutral-300 truncate max-w-[150px] sm:max-w-[200px]">
                    Welcome back, <span className="text-indigo-300 font-semibold">{displayName}</span>
                  </span>
                </span>
              </span>
              <span className="text-[11px] text-neutral-400 block -mt-0.5">
                Offline Cache & Custom Subtitles
              </span>
            </div>
          </button>


        </div>

        {/* Center Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="header-search-input"
              ref={searchInputRef}
              type="text"
              placeholder="Search movies, episodes, genres..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Navigation & Tools */}
        <div className="flex items-center space-x-2.5">
          {/* Home Button */}
          {onGoHome && (
            <button
              id="header-home-btn"
              type="button"
              onClick={onGoHome}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-100 hover:text-white transition cursor-pointer"
              title="Return to Home Library"
              aria-label="Return to Home Library"
            >
              <Home className="w-4 h-4 text-indigo-400" />
              <span>Home</span>
            </button>
          )}

          {/* Offline Cache Button */}
          <button
            onClick={onOpenOfflineModal}
            className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-200 transition cursor-pointer"
            title="View downloaded offline videos and storage quota"
          >
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>Offline Cache</span>
            {cachedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white font-semibold text-[10px]">
                {cachedCount}
              </span>
            )}
          </button>

          {/* Play Custom File / Stream URL */}
          <button
            onClick={onOpenDirectPlayModal}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-200 transition cursor-pointer"
            title="Play custom video URL or local file"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            <span>Open Stream / File</span>
          </button>

          {/* Jellyfin Server Switcher */}
          <button
            onClick={onOpenConnectModal}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Server className="w-4 h-4" />
            <span>
              {serverConfig.isDemoMode ? 'Connect Server' : 'Server Config'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Smartphone App Bar Layout */}
      <div className="md:hidden flex flex-col space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Brand & Logo with Home click */}
          <button
            id="mobile-brand-home-btn"
            type="button"
            onClick={onGoHome}
            className="flex items-center space-x-2 min-w-0 text-left cursor-pointer p-0.5 rounded-lg focus:outline-none"
            title="Return to Home"
            aria-label="Return to Home"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm flex-shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                <span>Jellyfin</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  Player
                </span>
              </h1>
            </div>
          </button>

          {/* Center-Right: Server Status Pill */}
          <button
            onClick={onOpenConnectModal}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition truncate max-w-[130px] ${
              serverConfig.isDemoMode
                ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
            }`}
            title="Manage server connection"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                serverConfig.isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="truncate">{serverConfig.isDemoMode ? 'Server' : serverConfig.serverName || 'Server'}</span>
          </button>

          {/* Right Mobile Actions */}
          <div className="flex items-center space-x-1">
            {/* Mobile Home Button */}
            {onGoHome && (
              <button
                id="mobile-header-home-btn"
                type="button"
                onClick={onGoHome}
                className="p-2 rounded-xl bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Go to Home"
                aria-label="Go to Home"
              >
                <Home className="w-4 h-4 text-indigo-400" />
              </button>
            )}

            {/* Mobile Search Toggle */}
            <button
              id="mobile-search-toggle-btn"
              type="button"
              onClick={handleToggleMobileSearch}
              className={`p-2 rounded-xl transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                mobileSearchOpen || searchQuery
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800'
              }`}
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Open Custom Stream/File */}
            <button
              id="mobile-direct-play-btn"
              type="button"
              onClick={onOpenDirectPlayModal}
              className="p-2 rounded-xl bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="Open stream or local file"
              aria-label="Open custom stream or local file"
            >
              <FolderPlus className="w-4 h-4 text-indigo-400" />
            </button>

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                id="mobile-theme-toggle-btn"
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-xl bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                title={theme === 'night' ? 'Dark mode' : 'Light mode'}
                aria-label="Toggle theme mode"
              >
                {theme === 'night' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Expandable Mobile Search Field */}
        {(mobileSearchOpen || searchQuery) && (
          <div className="pt-1 pb-0.5 animate-fadeIn">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                id="mobile-search-input"
                ref={mobileSearchInputRef}
                type="text"
                placeholder="Search movies, series, genres..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-neutral-900 border border-indigo-500/50 rounded-xl pl-9 pr-8 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 p-1 text-neutral-400 hover:text-white"
                  aria-label="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(false)}
                  className="absolute right-2.5 p-1 text-neutral-400 hover:text-white text-[10px]"
                  aria-label="Close search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

