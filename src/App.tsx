import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CachedOfflineMedia,
  DownloadProgress,
  FolderBreadcrumb,
  JellyfinItem,
  JellyfinServerConfig,
  MediaSortOption,
  SubtitleSettings,
  SubtitleTrack,
} from './types';
import {
  DEMO_MEDIA_LIBRARY,
  DemoItem,
  fetchJellyfinFolderContents,
  fetchJellyfinItems,
  fetchJellyfinUserViews,
  getMediaStreamUrl,
  getSubtitleStreamUrl,
} from './services/jellyfinApi';
import {
  deleteOfflineMedia,
  downloadMediaForOffline,
  formatBytes,
  getAllOfflineMedia,
  getStorageUsageEstimate,
} from './services/offlineStorage';
import { parseSubtitleText } from './services/subtitleParser';
import { Header } from './components/Header';
import { MediaCard } from './components/MediaCard';
import { MovieBannerCard } from './components/MovieBannerCard';
import { MovieBannerModal } from './components/MovieBannerModal';
import { FolderCard } from './components/FolderCard';
import { FolderBreadcrumbs } from './components/FolderBreadcrumbs';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitleSettingsModal } from './components/SubtitleSettingsModal';
import { OfflineManagerModal } from './components/OfflineManagerModal';
import { JellyfinConnectModal } from './components/JellyfinConnectModal';
import { DirectPlayModal } from './components/DirectPlayModal';
import { HistoryCard } from './components/HistoryCard';
import { MovieSlider } from './components/MovieSlider';
import { GenreFilterBar } from './components/GenreFilterBar';
import { ContinueWatchingSection } from './components/ContinueWatchingSection';
import { WatchHistoryStatsWidget } from './components/WatchHistoryStatsWidget';
import { MediaGridHeader } from './components/MediaGridHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileInstallPrompt } from './components/MobileInstallPrompt';
import { enrichItemWithImdbBanner } from './services/imdbBannerService';
import { ThemeMode } from './types';
import {
  getWatchHistory,
  clearWatchHistory,
  removeWatchHistoryItem,
  recordWatchHistory,
  WatchHistoryEntry,
} from './services/watchHistory';
import {
  Home,
  Film,
  HardDrive,
  Radio,
  RefreshCw,
  Server,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  FolderTree,
  Folder,
  Tv,
  ArrowLeft,
  History,
  Trash2,
  Clock,
} from 'lucide-react';

const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 24,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.65,
  hasOutline: true,
  outlineColor: '#000000',
  offsetSeconds: 0,
  position: 'bottom',
  lineHeight: 1.35,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  playNextEpisode: localStorage.getItem('jellyfin_autoplay_enabled') !== 'false',
};

export default function App() {
  // ---------------- Server Configuration State ----------------
  const [serverConfig, setServerConfig] = useState<JellyfinServerConfig>(() => {
    const saved = localStorage.getItem('jellyfin_server_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      serverUrl: 'https://demo.jellyfin.org/stable',
      username: 'demo',
      isDemoMode: true,
      serverName: 'Sample Open Library',
    };
  });

  // ---------------- Subtitle Settings State ----------------
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => {
    const saved = localStorage.getItem('jellyfin_subtitle_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SUBTITLE_SETTINGS, ...JSON.parse(saved) };
      } catch {
        // Fallback
      }
    }
    return DEFAULT_SUBTITLE_SETTINGS;
  });

  const handleUpdateSubtitleSettings = (newSettings: Partial<SubtitleSettings>) => {
    setSubtitleSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('jellyfin_subtitle_settings', JSON.stringify(updated));
      if (newSettings.playNextEpisode !== undefined) {
        localStorage.setItem('jellyfin_autoplay_enabled', String(newSettings.playNextEpisode));
        showToast(
          newSettings.playNextEpisode
            ? 'Play Next Episode enabled'
            : 'Play Next Episode disabled'
        );
      }
      return updated;
    });
  };

  // ---------------- Media & Library State ----------------
  const [items, setItems] = useState<JellyfinItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'folders' | 'all' | 'movies' | 'offline' | 'history'>('folders');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>(() => getWatchHistory());
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // ---------------- Media Grid Sorting State ----------------
  const [sortBy, setSortBy] = useState<MediaSortOption>('recently_added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSortChange = (newSort: MediaSortOption) => {
    setSortBy(newSort);
    if (newSort === 'alphabetical') {
      setSortOrder('asc');
    } else {
      setSortOrder('desc');
    }
  };

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // ---------------- View Layout (Cards Grid vs IMDb Movie Banners) & Banner Modal ----------------
  const [viewLayout, setViewLayout] = useState<'grid' | 'banner'>('grid');
  const [bannerModalItem, setBannerModalItem] = useState<JellyfinItem | null>(null);

  // ---------------- Day / Night Theme Mode State & CSS Variables ----------------
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // Default to 'night' (dark mode) as requested by user
    localStorage.setItem('jellyfin_theme_mode', 'night');
    return 'night';
  });

  // Sync dark class on root document element
  useEffect(() => {
    if (theme === 'night') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const nextTheme: ThemeMode = prev === 'day' ? 'night' : 'day';
      localStorage.setItem('jellyfin_theme_mode', nextTheme);
      return nextTheme;
    });
  };

  const handleSetTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    localStorage.setItem('jellyfin_theme_mode', newTheme);
  };

  // Adjust root CSS variables directly in App root element
  const rootThemeVariables = useMemo<React.CSSProperties>(() => {
    if (theme === 'day') {
      return {
        '--app-bg': '#f8fafc',
        '--app-surface': '#ffffff',
        '--app-surface-hover': '#f1f5f9',
        '--app-surface-muted': 'rgba(255, 255, 255, 0.85)',
        '--app-border': '#e2e8f0',
        '--app-border-strong': '#cbd5e1',
        '--app-text': '#0f172a',
        '--app-text-secondary': '#334155',
        '--app-text-muted': '#64748b',
        '--app-header-bg': 'rgba(255, 255, 255, 0.92)',
        '--app-card-bg': '#ffffff',
        '--app-badge-bg': '#e2e8f0',
        '--app-badge-text': '#1e293b',
        '--app-input-bg': '#ffffff',
        '--app-accent': '#4f46e5',
        backgroundColor: 'var(--app-bg)',
        color: 'var(--app-text)',
      } as React.CSSProperties;
    }
    return {
      '--app-bg': '#0a0a0a',
      '--app-surface': '#171717',
      '--app-surface-hover': '#262626',
      '--app-surface-muted': 'rgba(23, 23, 23, 0.7)',
      '--app-border': '#262626',
      '--app-border-strong': '#333333',
      '--app-text': '#f5f5f5',
      '--app-text-secondary': '#d4d4d4',
      '--app-text-muted': '#a3a3a3',
      '--app-header-bg': 'rgba(10, 10, 10, 0.90)',
      '--app-card-bg': '#171717',
      '--app-badge-bg': '#262626',
      '--app-badge-text': '#d4d4d4',
      '--app-input-bg': '#171717',
      '--app-accent': '#6366f1',
      backgroundColor: 'var(--app-bg)',
      color: 'var(--app-text)',
    } as React.CSSProperties;
  }, [theme]);

  // ---------------- Folder Hierarchy State (Matches Jellyfin Server) ----------------
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [currentFolderItem, setCurrentFolderItem] = useState<JellyfinItem | null>(null);
  const [topLevelViews, setTopLevelViews] = useState<JellyfinItem[]>([]);

  // ---------------- Offline Cache State ----------------
  const [cachedMedia, setCachedMedia] = useState<CachedOfflineMedia[]>([]);
  const [storageStats, setStorageStats] = useState({ usedBytes: 0, quotaBytes: 1, percentage: 0 });
  const [activeDownload, setActiveDownload] = useState<DownloadProgress | undefined>(undefined);
  const downloadAbortRef = useRef<AbortController | null>(null);

  // ---------------- Active Video Player State ----------------
  const [activeItem, setActiveItem] = useState<JellyfinItem | null>(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(null);
  const [isOfflinePlayback, setIsOfflinePlayback] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<string | undefined>(undefined);
  const activeBlobUrlRef = useRef<string | null>(null);

  // ---------------- Modals & View Modes State ----------------
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState(false);
  const [isDirectPlayModalOpen, setIsDirectPlayModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ---------------- Load Offline Storage on Mount ----------------
  const refreshOfflineData = async () => {
    try {
      const offlineList = await getAllOfflineMedia();
      setCachedMedia(offlineList);
      const stats = await getStorageUsageEstimate();
      setStorageStats(stats);
    } catch (err) {
      console.error('Error refreshing offline data:', err);
    }
  };

  useEffect(() => {
    refreshOfflineData();

    const handleHistoryUpdate = () => {
      setWatchHistory(getWatchHistory());
    };
    window.addEventListener('jellyfin_history_updated', handleHistoryUpdate);
    return () => window.removeEventListener('jellyfin_history_updated', handleHistoryUpdate);
  }, []);

  // ---------------- Load Top-Level Jellyfin Views / Libraries ----------------
  useEffect(() => {
    let isSubscribed = true;
    const loadViews = async () => {
      try {
        const views = await fetchJellyfinUserViews(serverConfig);
        if (isSubscribed) {
          setTopLevelViews(views);
        }
      } catch (err) {
        console.warn('Could not load user views directly:', err);
      }
    };
    loadViews();
    return () => {
      isSubscribed = false;
    };
  }, [serverConfig]);

  // ---------------- Load Media / Folder from Server or Demo ----------------
  const loadLibrary = async () => {
    setIsLoadingLibrary(true);
    setLibraryError(null);
    try {
      if (activeFilter === 'folders') {
        const folderItems = await fetchJellyfinFolderContents(
          serverConfig,
          currentFolderId,
          searchQuery
        );
        setItems(folderItems);
        // If at root without search query, also update top-level library views
        if (!currentFolderId && !searchQuery) {
          setTopLevelViews(folderItems.filter((i) => i.isFolder));
        }
      } else {
        const loadedItems = await fetchJellyfinItems(serverConfig, undefined, searchQuery);
        setItems(loadedItems);
      }
    } catch (err: any) {
      setLibraryError(err.message || 'Failed to connect to Jellyfin library');
      if (!serverConfig.isDemoMode) {
        showToast('Could not reach remote Jellyfin server. Loaded sample media.');
      }
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [serverConfig, searchQuery, currentFolderId, activeFilter]);

  // ---------------- Folder Navigation Handlers ----------------
  const handleOpenFolder = (folder: JellyfinItem) => {
    setSelectedGenre(null);
    setFolderBreadcrumbs((prev) => [
      ...prev,
      {
        id: folder.id,
        name: folder.name,
        type: folder.type,
        collectionType: folder.collectionType,
      },
    ]);
    setCurrentFolderId(folder.id);
    setCurrentFolderItem(folder);
    if (activeFilter !== 'folders') {
      setActiveFilter('folders');
    }
  };

  const handleNavigateBreadcrumb = (index: number) => {
    const targetCrumb = folderBreadcrumbs[index];
    setFolderBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(targetCrumb.id);
    setCurrentFolderItem({
      id: targetCrumb.id,
      name: targetCrumb.name,
      type: targetCrumb.type || 'Folder',
      collectionType: targetCrumb.collectionType,
    });
  };

  const handleNavigateHome = () => {
    setFolderBreadcrumbs([]);
    setCurrentFolderId(undefined);
    setCurrentFolderItem(null);
  };

  // ---------------- Global Go Home Handler ----------------
  const handleGoHome = () => {
    // If a video is playing, close video player and clean up
    if (activeItem) {
      handleClosePlayer();
    }
    setActiveFilter('folders');
    setCurrentFolderId(undefined);
    setFolderBreadcrumbs([]);
    setCurrentFolderItem(null);
    setSelectedGenre(null);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateBack = () => {
    if (folderBreadcrumbs.length <= 1) {
      handleNavigateHome();
    } else {
      const newBreadcrumbs = folderBreadcrumbs.slice(0, folderBreadcrumbs.length - 1);
      const targetCrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
      setFolderBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(targetCrumb.id);
      setCurrentFolderItem({
        id: targetCrumb.id,
        name: targetCrumb.name,
        type: targetCrumb.type || 'Folder',
        collectionType: targetCrumb.collectionType,
      });
    }
  };

  const handleSelectTopLibrary = (library: JellyfinItem) => {
    setFolderBreadcrumbs([
      {
        id: library.id,
        name: library.name,
        type: library.type,
        collectionType: library.collectionType,
      },
    ]);
    setCurrentFolderId(library.id);
    setCurrentFolderItem(library);
    setActiveFilter('folders');
  };

  // ---------------- Switch Server Config ----------------
  const handleSaveServerConfig = (newConfig: JellyfinServerConfig) => {
    setServerConfig(newConfig);
    localStorage.setItem('jellyfin_server_config', JSON.stringify(newConfig));
    showToast(`Connected to ${newConfig.serverName || newConfig.serverUrl}`);
  };

  const handleSwitchToDemo = () => {
    const demoConfig: JellyfinServerConfig = {
      serverUrl: 'https://demo.jellyfin.org/stable',
      username: 'demo',
      isDemoMode: true,
      serverName: 'Sample Open Library',
    };
    setServerConfig(demoConfig);
    localStorage.setItem('jellyfin_server_config', JSON.stringify(demoConfig));
    showToast('Switched to open sample library');
  };

  // ---------------- Play Video Handler ----------------
  const handlePlayItem = async (item: JellyfinItem) => {
    // Record into watch history
    recordWatchHistory(item, 0, item.durationSeconds || 0, false);

    // Revoke previous blob URL if any
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    // Check if this item is cached offline
    const offlineCached = cachedMedia.find((c) => c.id === item.id);

    if (offlineCached) {
      // Play directly from offline IndexedDB Blob!
      const blobUrl = URL.createObjectURL(offlineCached.videoBlob);
      activeBlobUrlRef.current = blobUrl;
      setActiveItem({
        ...item,
        chapters: offlineCached.chapters || item.chapters,
        introSegment: offlineCached.introSegment || item.introSegment,
        seriesName: offlineCached.seriesName || item.seriesName,
        seriesId: offlineCached.seriesId || item.seriesId,
        seasonName: offlineCached.seasonName || item.seasonName,
        seasonId: offlineCached.seasonId || item.seasonId,
        indexNumber: offlineCached.indexNumber ?? item.indexNumber,
        parentIndexNumber: offlineCached.parentIndexNumber ?? item.parentIndexNumber,
      });
      setActiveStreamUrl(blobUrl);
      setIsOfflinePlayback(true);

      // Load offline cached subtitles
      const offlineTracks: SubtitleTrack[] = (offlineCached.subtitles || []).map((s) => ({
        id: s.id,
        label: `${s.label} (Offline)`,
        language: s.language,
        source: 'jellyfin',
        format: s.format,
        rawText: s.rawText,
        cues: parseSubtitleText(s.rawText),
      }));

      setAvailableSubtitles(offlineTracks);
      setSelectedSubtitleTrackId(offlineTracks[0]?.id);
      return;
    }

    // Otherwise, play from server or demo stream URL
    const streamUrl = getMediaStreamUrl(serverConfig, item);
    setActiveItem(item);
    setActiveStreamUrl(streamUrl);
    setIsOfflinePlayback(false);

    // Populate subtitle tracks
    if (serverConfig.isDemoMode) {
      const demo = DEMO_MEDIA_LIBRARY.find((d) => d.id === item.id);
      if (demo && demo.subtitlesList) {
        const demoTracks: SubtitleTrack[] = demo.subtitlesList.map((s) => ({
          id: s.id,
          label: s.label,
          language: s.language,
          source: 'jellyfin',
          format: s.format,
          rawText: s.rawText,
          cues: parseSubtitleText(s.rawText),
        }));
        setAvailableSubtitles(demoTracks);
        setSelectedSubtitleTrackId(demoTracks[0]?.id);
        return;
      }
    }

    // Remote Jellyfin server subtitle streams
    const subStreams = (item.mediaStreams || []).filter((s) => s.type === 'Subtitle');
    const remoteTracks: SubtitleTrack[] = [];

    for (const sub of subStreams) {
      const subUrl = getSubtitleStreamUrl(
        serverConfig,
        item.id,
        item.mediaSources?.[0]?.id || item.id,
        sub.index,
        'vtt'
      );
      remoteTracks.push({
        id: `remote-sub-${sub.index}`,
        label: sub.displayTitle || `Track ${sub.index} (${sub.language || 'Sub'})`,
        language: sub.language,
        source: 'jellyfin',
        format: 'vtt',
        url: subUrl,
      });
    }

    // Fetch active first subtitle text if available
    if (remoteTracks.length > 0) {
      try {
        const first = remoteTracks[0];
        if (first.url) {
          const res = await fetch(first.url);
          if (res.ok) {
            const vttText = await res.text();
            first.rawText = vttText;
            first.cues = parseSubtitleText(vttText);
          }
        }
      } catch {
        // Fallback
      }
    }

    setAvailableSubtitles(remoteTracks);
    setSelectedSubtitleTrackId(remoteTracks[0]?.id);
  };

  // ---------------- Play Direct Stream / Local File ----------------
  const handlePlayDirect = (item: JellyfinItem, streamUrl: string) => {
    recordWatchHistory(item, 0, item.durationSeconds || 0, false);
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    setActiveItem(item);
    setActiveStreamUrl(streamUrl);
    setIsOfflinePlayback(false);
    setAvailableSubtitles([]);
    setSelectedSubtitleTrackId(undefined);
  };

  // ---------------- Close Player ----------------
  const handleClosePlayer = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    setActiveItem(null);
    setActiveStreamUrl(null);
    setIsOfflinePlayback(false);
  };

  // Determine next episode in series for Autoplay
  const nextEpisode = useMemo(() => {
    if (!activeItem) return null;

    // Combine current fetched library with cached offline media and demo library
    const combinedItems: JellyfinItem[] = [...items];
    if (serverConfig.isDemoMode) {
      for (const demo of DEMO_MEDIA_LIBRARY) {
        if (!combinedItems.some((i) => i.id === demo.id)) {
          combinedItems.push(demo);
        }
      }
    }
    for (const cached of cachedMedia) {
      if (!combinedItems.some((i) => i.id === cached.id)) {
        combinedItems.push({
          id: cached.id,
          name: cached.name,
          overview: cached.overview,
          type: cached.type,
          durationSeconds: cached.durationSeconds,
          productionYear: cached.productionYear,
          genres: cached.genres,
          chapters: cached.chapters,
          seriesName: cached.seriesName,
          seriesId: cached.seriesId,
          seasonName: cached.seasonName,
          seasonId: cached.seasonId,
          indexNumber: cached.indexNumber,
          parentIndexNumber: cached.parentIndexNumber,
          isOfflineCached: true,
        });
      }
    }

    // 1. If item has seriesId or seriesName:
    if (activeItem.seriesId || activeItem.seriesName) {
      const seriesEpisodes = combinedItems.filter((i) => {
        if (activeItem.seriesId && i.seriesId) {
          return i.seriesId === activeItem.seriesId;
        }
        if (activeItem.seriesName && i.seriesName) {
          return i.seriesName.toLowerCase() === activeItem.seriesName.toLowerCase();
        }
        return false;
      });

      if (seriesEpisodes.length > 1) {
        seriesEpisodes.sort((a, b) => {
          const seasonA = a.parentIndexNumber ?? 1;
          const seasonB = b.parentIndexNumber ?? 1;
          if (seasonA !== seasonB) return seasonA - seasonB;
          const epA = a.indexNumber ?? 0;
          const epB = b.indexNumber ?? 0;
          return epA - epB;
        });

        const currentIndex = seriesEpisodes.findIndex((ep) => ep.id === activeItem.id);
        if (currentIndex !== -1 && currentIndex < seriesEpisodes.length - 1) {
          return seriesEpisodes[currentIndex + 1];
        }
      }
    }

    // 2. If item is marked as an Episode and has indexNumber:
    if (activeItem.type === 'Episode' && activeItem.indexNumber !== undefined) {
      const nextByNumber = combinedItems.find(
        (i) =>
          i.type === 'Episode' &&
          (i.seriesName === activeItem.seriesName || i.seriesId === activeItem.seriesId) &&
          (i.indexNumber ?? 0) === (activeItem.indexNumber ?? 0) + 1
      );
      if (nextByNumber) return nextByNumber;
    }

    // 3. Sequential next item in current library list (e.g. adjacent episode or next item)
    const listIndex = combinedItems.findIndex((i) => i.id === activeItem.id);
    if (listIndex !== -1 && listIndex < combinedItems.length - 1) {
      const nextCandidate = combinedItems[listIndex + 1];
      if (
        nextCandidate &&
        (nextCandidate.seriesName === activeItem.seriesName ||
          nextCandidate.seriesId === activeItem.seriesId ||
          (activeItem.type === 'Episode' && nextCandidate.type === 'Episode'))
      ) {
        return nextCandidate;
      }
    }

    return null;
  }, [activeItem, items, cachedMedia]);

  // ---------------- Download Media for Offline ----------------
  const handleDownloadOffline = async (item: JellyfinItem) => {
    if (activeDownload && activeDownload.status === 'downloading') {
      showToast('Another download is already in progress.');
      return;
    }

    try {
      const abortCtrl = new AbortController();
      downloadAbortRef.current = abortCtrl;

      const streamUrl = getMediaStreamUrl(serverConfig, item);

      // Collect subtitles to save offline
      const subtitlesToSave: Array<{
        id: string;
        label: string;
        language?: string;
        rawText: string;
        format: 'srt' | 'vtt';
      }> = [];

      if (serverConfig.isDemoMode) {
        const demo = DEMO_MEDIA_LIBRARY.find((d) => d.id === item.id);
        if (demo?.subtitlesList) {
          subtitlesToSave.push(...demo.subtitlesList);
        }
      } else {
        const subStreams = (item.mediaStreams || []).filter((s) => s.type === 'Subtitle');
        for (const sub of subStreams.slice(0, 3)) {
          try {
            const subUrl = getSubtitleStreamUrl(
              serverConfig,
              item.id,
              item.mediaSources?.[0]?.id || item.id,
              sub.index,
              'vtt'
            );
            const res = await fetch(subUrl);
            if (res.ok) {
              const text = await res.text();
              subtitlesToSave.push({
                id: `cached-sub-${sub.index}`,
                label: sub.displayTitle || `Subtitle ${sub.language || ''}`,
                language: sub.language,
                rawText: text,
                format: 'vtt',
              });
            }
          } catch {
            // Ignore single subtitle fetch failure
          }
        }
      }

      await downloadMediaForOffline(
        item,
        streamUrl,
        subtitlesToSave,
        (progress) => {
          setActiveDownload(progress);
        },
        abortCtrl.signal
      );

      await refreshOfflineData();
      showToast(`Successfully cached "${item.name}" for offline viewing!`);
    } catch (err: any) {
      if (err.message?.includes('aborted')) {
        showToast('Download cancelled.');
      } else {
        showToast(`Download failed: ${err.message}`);
      }
    } finally {
      setActiveDownload(undefined);
      downloadAbortRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (downloadAbortRef.current) {
      downloadAbortRef.current.abort();
    }
  };

  // ---------------- Delete Cached Offline Item ----------------
  const handleDeleteCachedItem = async (id: string) => {
    try {
      await deleteOfflineMedia(id);
      await refreshOfflineData();
      showToast('Media removed from offline storage');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete offline media');
    }
  };

  // ---------------- Custom Subtitle Upload in Player ----------------
  const handleAddCustomSubtitleTrack = (track: SubtitleTrack) => {
    setAvailableSubtitles((prev) => [track, ...prev]);
    setSelectedSubtitleTrackId(track.id);
    showToast(`Loaded custom subtitle track: ${track.label}`);
  };

  // ---------------- Genre Filter Handler ----------------
  const handleGenreFilter = (genre: string) => {
    const isAlreadySelected = selectedGenre?.trim().toLowerCase() === genre.trim().toLowerCase();
    if (isAlreadySelected) {
      setSelectedGenre(null);
    } else {
      setSelectedGenre(genre);
      if (activeFilter === 'folders' || activeFilter === 'history') {
        setActiveFilter('all');
      }
    }
  };

  // ---------------- Available Genres for Current View ----------------
  const genreData = useMemo(() => {
    let sourceList: JellyfinItem[] = [];
    if (activeFilter === 'movies') {
      sourceList = items.filter((i) => !i.isFolder && (i.type === 'Movie' || !i.type));
    } else if (activeFilter === 'all') {
      sourceList = items.filter((i) => !i.isFolder);
    } else if (activeFilter === 'offline') {
      sourceList = cachedMedia.map((c): JellyfinItem => ({
        id: c.id,
        name: c.name,
        type: c.type,
        genres: c.genres,
        isFolder: false,
      }));
    } else {
      sourceList = items.filter((i) => !i.isFolder);
    }

    const counts: Record<string, number> = {};
    sourceList.forEach((item) => {
      item.genres?.forEach((genre) => {
        const trimmed = genre.trim();
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        }
      });
    });

    const sortedGenres = Object.keys(counts).sort((a, b) => {
      if (counts[b] !== counts[a]) {
        return counts[b] - counts[a];
      }
      return a.localeCompare(b);
    });

    return { genres: sortedGenres, counts, totalCount: sourceList.length };
  }, [items, cachedMedia, activeFilter]);

  const movieCount = useMemo(
    () => items.filter((i) => !i.isFolder && (i.type === 'Movie' || !i.type)).length,
    [items]
  );

  // ---------------- Filtered & Sorted Media Items ----------------
  const filteredItems = useMemo((): JellyfinItem[] => {
    let baseList: JellyfinItem[] = [];

    if (activeFilter === 'offline') {
      baseList = cachedMedia.map((c): JellyfinItem => ({
        id: c.id,
        name: c.name,
        overview: c.overview,
        type: c.type,
        durationSeconds: c.durationSeconds,
        productionYear: c.productionYear,
        genres: c.genres,
        chapters: c.chapters,
        dateCreated: new Date(c.cachedAt).toISOString(),
        isFolder: false,
        isOfflineCached: true,
        offlineBlobSize: c.fileSizeBytes,
      }));
    } else if (activeFilter === 'movies') {
      baseList = items.filter((i) => i.type === 'Movie');
    } else {
      baseList = items;
    }

    // Apply genre tag filter if active
    if (selectedGenre) {
      baseList = baseList.filter((item) =>
        !item.isFolder && item.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    // Sort items according to active sortBy & sortOrder
    const sorted = [...baseList].sort((a, b) => {
      // In folder view or when folders are mixed in, group folders at the top
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let comparison = 0;
      if (sortBy === 'alphabetical') {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === 'release_year') {
        const yearA = a.productionYear ?? 0;
        const yearB = b.productionYear ?? 0;
        if (yearA !== yearB) {
          comparison = yearA - yearB;
        } else {
          comparison = a.name.localeCompare(b.name);
        }
      } else {
        // 'recently_added': compare dateCreated timestamp
        const timeA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const timeB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        if (timeA !== timeB) {
          comparison = timeA - timeB;
        } else {
          // Fallback if timestamps are identical or absent: newer release year or name
          const yearA = a.productionYear ?? 0;
          const yearB = b.productionYear ?? 0;
          if (yearA !== yearB) {
            comparison = yearA - yearB;
          } else {
            comparison = a.name.localeCompare(b.name);
          }
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted.map((item) => enrichItemWithImdbBanner(item));
  }, [items, cachedMedia, activeFilter, selectedGenre, sortBy, sortOrder]);

  const mediaGridTitle = useMemo(() => {
    if (searchQuery.trim()) {
      return `Search: "${searchQuery.trim()}"`;
    }
    if (selectedGenre) {
      return `${selectedGenre} Titles`;
    }
    if (activeFilter === 'movies') {
      return 'Movies Collection';
    }
    if (activeFilter === 'offline') {
      return 'Offline Downloads';
    }
    if (activeFilter === 'folders') {
      const currentCrumb = folderBreadcrumbs[folderBreadcrumbs.length - 1];
      return currentCrumb ? currentCrumb.name : 'Server Folders';
    }
    return 'Media Catalog';
  }, [searchQuery, selectedGenre, activeFilter, folderBreadcrumbs]);

  const cachedItemIds = useMemo(() => {
    return new Set(cachedMedia.map((c) => c.id));
  }, [cachedMedia]);

  // ---------------- Available Movies for Carousel Slider ----------------
  const availableMovies = useMemo((): JellyfinItem[] => {
    let resultList: JellyfinItem[] = [];

    // 1. If currently in 'movies' filter, use the filtered movies
    if (activeFilter === 'movies') {
      const moviesList = items.filter((i) => !i.isFolder && (i.type === 'Movie' || !i.type));
      if (moviesList.length > 0) {
        if (selectedGenre) {
          const matching = moviesList.filter((i) =>
            i.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
          );
          if (matching.length > 0) resultList = matching;
        }
        if (resultList.length === 0) resultList = moviesList;
      }
    }

    // 2. Gather non-folder media items from currently loaded items
    if (resultList.length === 0) {
      const nonFolderItems = items.filter((i) => !i.isFolder);
      if (nonFolderItems.length > 0) {
        let moviesOnly = nonFolderItems.filter(
          (i) => i.type === 'Movie' || i.type === 'Episode' || i.type === 'Video'
        );
        if (moviesOnly.length === 0) moviesOnly = nonFolderItems;
        if (selectedGenre) {
          const matching = moviesOnly.filter((i) =>
            i.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
          );
          if (matching.length > 0) resultList = matching;
        }
        if (resultList.length === 0) resultList = moviesOnly;
      }
    }

    // 3. When in demo mode (e.g. root folders view), show available open movie library
    if (resultList.length === 0 && serverConfig.isDemoMode) {
      let demoList = DEMO_MEDIA_LIBRARY.map((item) => ({
        ...item,
        type: 'Movie',
        isFolder: false,
      }));
      if (selectedGenre) {
        const matching = demoList.filter((i) =>
          i.genres?.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
        );
        if (matching.length > 0) resultList = matching;
      }
      if (resultList.length === 0) resultList = demoList;
    }

    // 4. Fallback to offline cached titles if any
    if (resultList.length === 0 && cachedMedia.length > 0) {
      resultList = cachedMedia.map((c) => ({
        id: c.id,
        name: c.name,
        overview: c.overview,
        type: c.type,
        durationSeconds: c.durationSeconds,
        productionYear: c.productionYear,
        genres: c.genres,
        chapters: c.chapters,
        isFolder: false,
        isOfflineCached: true,
      }));
    }

    return resultList.map((item) => enrichItemWithImdbBanner(item));
  }, [items, serverConfig.isDemoMode, cachedMedia, activeFilter, selectedGenre]);

  // ---------------- Filtered Watch History ----------------
  const filteredHistory = useMemo((): WatchHistoryEntry[] => {
    if (!searchQuery.trim()) return watchHistory;
    const q = searchQuery.toLowerCase();
    return watchHistory.filter(
      (h) =>
        h.item.name.toLowerCase().includes(q) ||
        h.item.seriesName?.toLowerCase().includes(q) ||
        h.item.genres?.some((g) => g.toLowerCase().includes(q))
    );
  }, [watchHistory, searchQuery]);

  const handleClearAllHistory = () => {
    clearWatchHistory();
    setShowClearConfirmModal(false);
    showToast('Watch history has been completely cleared');
  };

  const handleRemoveHistoryItem = (itemId: string) => {
    removeWatchHistoryItem(itemId);
    showToast('Removed from watch history');
  };

  return (
    <div
      id="app-root"
      data-theme={theme}
      style={rootThemeVariables}
      className="min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs shadow-2xl animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        serverConfig={serverConfig}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
        onOpenDirectPlayModal={() => setIsDirectPlayModalOpen(true)}
        cachedCount={cachedMedia.length}
        cachedTotalBytes={storageStats.usedBytes}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGoHome={handleGoHome}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 pb-24 md:pb-8">
        {/* Available Movies Carousel Slider Panel */}
        {activeFilter !== 'history' && availableMovies.length > 0 && (
          <MovieSlider
            movies={availableMovies}
            onPlay={handlePlayItem}
            onDownload={handleDownloadOffline}
            cachedItemIds={cachedItemIds}
            activeDownloadItemId={activeDownload?.status === 'downloading' ? activeDownload.itemId : undefined}
            selectedGenre={selectedGenre}
            onGenreClick={handleGenreFilter}
            onViewBanner={(bannerItem) => setBannerModalItem(bannerItem)}
          />
        )}

        {/* Folder Breadcrumbs and Navigation (active when in Folders view) */}
        {activeFilter === 'folders' && (
          <div className="space-y-4">
            <FolderBreadcrumbs
              breadcrumbs={folderBreadcrumbs}
              onNavigate={handleNavigateBreadcrumb}
              onNavigateHome={handleNavigateHome}
              onNavigateBack={handleNavigateBack}
              currentFolderItem={currentFolderItem}
            />

            {/* Quick Top-Level Library Switcher Chips */}
            {topLevelViews.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                <span className="text-neutral-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                  Libraries:
                </span>
                <button
                  onClick={handleNavigateHome}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition whitespace-nowrap font-medium text-xs ${
                    folderBreadcrumbs.length === 0
                      ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                      : 'bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/80'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>All Libraries</span>
                </button>
                {topLevelViews.map((view) => {
                  const isCurrent =
                    folderBreadcrumbs.length > 0 && folderBreadcrumbs[0].id === view.id;
                  return (
                    <button
                      key={view.id}
                      onClick={() => handleSelectTopLibrary(view)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition whitespace-nowrap font-medium text-xs ${
                        isCurrent
                          ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 shadow-sm'
                          : 'bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/80'
                      }`}
                    >
                      {view.collectionType === 'movies' ? (
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                      ) : view.collectionType === 'tvshows' ? (
                        <Tv className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{view.name}</span>
                      {view.childCount !== undefined && (
                        <span className="text-[10px] opacity-60 bg-neutral-800 px-1.5 py-0.2 rounded-full ml-0.5">
                          {view.childCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-2 flex-nowrap">
            <button
              id="filter-tab-home"
              type="button"
              onClick={handleGoHome}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeFilter === 'folders' && !currentFolderId && !selectedGenre && !searchQuery
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
              title="Home (Reset to Library Root)"
            >
              <Home className="w-3.5 h-3.5 text-indigo-400" />
              <span>Home</span>
            </button>
            <button
              onClick={() => {
                setActiveFilter('folders');
                setSelectedGenre(null);
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                activeFilter === 'folders' && (currentFolderId || selectedGenre || searchQuery)
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Server Folders</span>
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              All Titles ({items.length})
            </button>
            <button
              onClick={() => setActiveFilter('movies')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeFilter === 'movies'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Movies ({movieCount})
            </button>
            <button
              onClick={() => setActiveFilter('offline')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeFilter === 'offline'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Offline Ready ({cachedMedia.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveFilter('history');
                setSelectedGenre(null);
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeFilter === 'history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({watchHistory.length})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeFilter === 'history' && watchHistory.length > 0 && (
              <button
                onClick={() => setShowClearConfirmModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition shadow-sm"
                title="Clear all watch history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
            <button
              onClick={loadLibrary}
              disabled={isLoadingLibrary}
              className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition"
              title="Refresh Library"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLibrary ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Genre-based Filtering UI for Current Media View */}
        {activeFilter !== 'history' && genreData.genres.length > 0 && (
          <GenreFilterBar
            genres={genreData.genres}
            genreCounts={genreData.counts}
            selectedGenre={selectedGenre}
            onSelectGenre={(genre) => (genre ? handleGenreFilter(genre) : setSelectedGenre(null))}
            totalCount={genreData.totalCount}
          />
        )}

        {/* Active Download notification bar if running */}
        {activeDownload && activeDownload.status === 'downloading' && (
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
              <div className="text-xs">
                <span className="font-semibold text-indigo-200">
                  Downloading for Offline: {activeDownload.itemName}
                </span>
                <span className="text-neutral-400 ml-2">
                  ({activeDownload.percent}% • {formatBytes(activeDownload.loadedBytes)} / {activeDownload.totalBytes ? formatBytes(activeDownload.totalBytes) : '...'})
                </span>
              </div>
            </div>
            <button
              onClick={handleCancelDownload}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Continue Watching Horizontal Section (Top 5 items with progress bars) */}
        {activeFilter !== 'history' && watchHistory.length > 0 && !searchQuery.trim() && (
          <ContinueWatchingSection
            items={watchHistory}
            onPlay={handlePlayItem}
            onRemove={handleRemoveHistoryItem}
            onViewAllHistory={() => {
              setActiveFilter('history');
              setSelectedGenre(null);
            }}
            cachedItemIds={cachedItemIds}
          />
        )}

        {/* Media / Folder Grid OR History View */}
        {activeFilter === 'history' ? (
          <div className="space-y-6">
            {/* History Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Watch History</span>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-xs font-semibold">
                      {filteredHistory.length}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Previously watched videos with their saved playback timestamp and progress
                  </p>
                </div>
              </div>

              {watchHistory.length > 0 && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Entire Watch History</span>
                </button>
              )}
            </div>

            {/* Watch History Analytics Dashboard Widget */}
            {watchHistory.length > 0 && (
              <WatchHistoryStatsWidget entries={watchHistory} />
            )}

            {/* History Items Grid or Empty State */}
            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 bg-neutral-900/30 rounded-3xl border border-neutral-800 space-y-3">
                <History className="w-12 h-12 text-neutral-600 mx-auto" />
                <h3 className="text-base font-semibold text-neutral-300">
                  {watchHistory.length === 0 ? 'No watch history yet' : 'No matching history items found'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {watchHistory.length === 0
                    ? 'Videos and movies you play will appear here with your last playback position, timestamp, and resume point.'
                    : 'Try clearing your search query to view all previously watched titles.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
                  >
                    <span>Clear Search Query</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredHistory.map((entry) => (
                  <HistoryCard
                    key={entry.itemId}
                    entry={entry}
                    onPlay={handlePlayItem}
                    onRemove={handleRemoveHistoryItem}
                    serverUrl={serverConfig.serverUrl}
                    isCached={cachedItemIds.has(entry.itemId)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header of the Media Grid with Sorting Dropdown & Layout Mode */}
            <MediaGridHeader
              title={mediaGridTitle}
              count={filteredItems.length}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              sortOrder={sortOrder}
              onToggleSortOrder={handleToggleSortOrder}
              viewLayout={viewLayout}
              onViewLayoutChange={setViewLayout}
            />

            {filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-neutral-900/30 rounded-3xl border border-neutral-800 space-y-3">
                <Film className="w-12 h-12 text-neutral-600 mx-auto" />
                <h3 className="text-base font-semibold text-neutral-300">
                  {selectedGenre
                    ? `No titles found matching genre "${selectedGenre}"`
                    : activeFilter === 'offline'
                    ? 'No offline videos cached yet'
                    : activeFilter === 'folders'
                    ? 'This folder is empty'
                    : 'No media items found'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {selectedGenre
                    ? `Try selecting another genre tag or reset the filter to view all ${activeFilter === 'movies' ? 'movies' : 'titles'}.`
                    : activeFilter === 'offline'
                    ? 'Click "Cache" on any movie card to store it for offline flight or commute playback.'
                    : activeFilter === 'folders'
                    ? 'There are no subfolders or media files inside this directory.'
                    : 'Try clearing your search query or connect a different Jellyfin library.'}
                </p>
                {selectedGenre ? (
                  <button
                    onClick={() => setSelectedGenre(null)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-md cursor-pointer"
                  >
                    <span>Clear Genre Filter</span>
                  </button>
                ) : activeFilter === 'folders' && folderBreadcrumbs.length > 0 ? (
                  <button
                    onClick={handleNavigateBack}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Go back up</span>
                  </button>
                ) : null}
              </div>
            ) : viewLayout === 'banner' ? (
              <div className="space-y-4 sm:space-y-6">
                {filteredItems.map((item) => {
                  if (item.isFolder) {
                    return (
                      <FolderCard
                        key={item.id}
                        folder={item}
                        onOpen={handleOpenFolder}
                      />
                    );
                  }
                  return (
                    <MovieBannerCard
                      key={item.id}
                      item={item}
                      onPlay={handlePlayItem}
                      onDownload={handleDownloadOffline}
                      isCached={cachedItemIds.has(item.id)}
                      downloadProgress={activeDownload?.itemId === item.id ? activeDownload : undefined}
                      selectedGenre={selectedGenre}
                      onGenreClick={handleGenreFilter}
                      onViewBanner={(bannerItem) => setBannerModalItem(bannerItem)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredItems.map((item) => {
                  if (item.isFolder) {
                    return (
                      <FolderCard
                        key={item.id}
                        folder={item}
                        onOpen={handleOpenFolder}
                      />
                    );
                  }
                  return (
                    <MediaCard
                      key={item.id}
                      item={item}
                      onPlay={handlePlayItem}
                      onDownload={handleDownloadOffline}
                      isCached={cachedItemIds.has(item.id)}
                      downloadProgress={activeDownload?.itemId === item.id ? activeDownload : undefined}
                      selectedGenre={selectedGenre}
                      onGenreClick={handleGenreFilter}
                      onViewBanner={(bannerItem) => setBannerModalItem(bannerItem)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Video Player Overlay */}
      {activeItem && activeStreamUrl && (
        <VideoPlayer
          item={activeItem}
          streamUrl={activeStreamUrl}
          isOfflinePlayback={isOfflinePlayback}
          onBack={handleClosePlayer}
          serverConfig={serverConfig}
          availableSubtitles={availableSubtitles}
          onOpenSubtitleSettings={() => setIsSubtitleModalOpen(true)}
          subtitleSettings={subtitleSettings}
          selectedSubtitleTrackId={selectedSubtitleTrackId}
          onSelectSubtitleTrack={setSelectedSubtitleTrackId}
          onDownloadOffline={handleDownloadOffline}
          downloadProgress={activeDownload?.itemId === activeItem.id ? activeDownload : undefined}
          isItemCached={cachedItemIds.has(activeItem.id)}
          nextEpisode={nextEpisode}
          onPlayNextEpisode={handlePlayItem}
        />
      )}

      {/* Subtitle Settings Modal */}
      <SubtitleSettingsModal
        isOpen={isSubtitleModalOpen}
        onClose={() => setIsSubtitleModalOpen(false)}
        tracks={availableSubtitles}
        selectedTrackId={selectedSubtitleTrackId}
        onSelectTrack={setSelectedSubtitleTrackId}
        onAddCustomTrack={handleAddCustomSubtitleTrack}
        settings={subtitleSettings}
        onUpdateSettings={handleUpdateSubtitleSettings}
      />

      {/* Offline Storage Manager Modal */}
      <OfflineManagerModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        cachedMedia={cachedMedia}
        onPlayCachedItem={(cached) => {
          handlePlayItem({
            id: cached.id,
            name: cached.name,
            overview: cached.overview,
            type: cached.type,
            durationSeconds: cached.durationSeconds,
            productionYear: cached.productionYear,
            genres: cached.genres,
            chapters: cached.chapters,
            seriesName: cached.seriesName,
            seriesId: cached.seriesId,
            seasonName: cached.seasonName,
            seasonId: cached.seasonId,
            indexNumber: cached.indexNumber,
            parentIndexNumber: cached.parentIndexNumber,
            isOfflineCached: true,
          });
        }}
        onDeleteCachedItem={handleDeleteCachedItem}
        storageStats={storageStats}
        activeDownload={activeDownload}
        onCancelDownload={handleCancelDownload}
      />

      {/* Jellyfin Server Connection Modal */}
      <JellyfinConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentConfig={serverConfig}
        onSaveConfig={handleSaveServerConfig}
        onSwitchToDemo={handleSwitchToDemo}
      />

      {/* Direct Play Stream / Local File Modal */}
      <DirectPlayModal
        isOpen={isDirectPlayModalOpen}
        onClose={() => setIsDirectPlayModalOpen(false)}
        onPlayDirect={handlePlayDirect}
      />

      {/* Clear Watch History Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clear Watch History?</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  This will remove all {watchHistory.length} watched video records and reset their saved playback timestamps.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllHistory}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMDb Movie Banner Preview & Info Modal */}
      <MovieBannerModal
        item={bannerModalItem}
        isOpen={Boolean(bannerModalItem)}
        onClose={() => setBannerModalItem(null)}
        onPlay={handlePlayItem}
        onDownload={handleDownloadOffline}
        isCached={bannerModalItem ? cachedItemIds.has(bannerModalItem.id) : false}
        selectedGenre={selectedGenre}
        onGenreClick={handleGenreFilter}
      />

      {/* Mobile Smartphone Bottom Navigation Bar */}
      {!activeItem && (
        <MobileBottomNav
          activeTab={activeFilter}
          onTabChange={(tab) => {
            if (tab === 'all') {
              handleGoHome();
            } else {
              setActiveFilter(tab);
              setSelectedGenre(null);
            }
          }}
          cachedCount={cachedMedia.length}
          serverConfig={serverConfig}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onGoHome={handleGoHome}
        />
      )}

      {/* Progressive Web App Mobile Install Prompt */}
      {!activeItem && <MobileInstallPrompt />}
    </div>
  );
}
