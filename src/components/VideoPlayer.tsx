import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DownloadProgress, JellyfinItem, JellyfinServerConfig, MediaChapter, SubtitleSettings, SubtitleTrack, VideoResolutionTier } from '../types';
import { SubtitleOverlay } from './SubtitleOverlay';
import { ResumePromptModal } from './ResumePromptModal';
import { ResolutionMenu } from './ResolutionMenu';
import {
  getMediaStreamUrl,
  reportPlaybackStart,
  reportPlaybackProgress,
  reportPlaybackStopped,
} from '../services/jellyfinApi';
import {
  computeAdaptiveResolution,
  determineResolutionFromBandwidth,
  getNetworkInfo,
  getSavedResolutionPreference,
  NetworkHealthInfo,
  RESOLUTION_PRESETS,
  saveResolutionPreference,
} from '../services/adaptiveResolution';
import {
  clearPlaybackResume,
  getPlaybackResume,
  PlaybackResumeEntry,
  savePlaybackResume,
} from '../services/playbackResume';
import { recordWatchHistory } from '../services/watchHistory';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  Settings,
  ArrowLeft,
  Home,
  Download,
  CheckCircle2,
  Loader2,
  PictureInPicture2,
  Radio,
  Sliders,
  Bookmark,
  ListVideo,
  ChevronRight,
  Clock,
  SkipForward,
  SkipBack,
  Sparkles,
  Tv,
  X,
  FastForward,
  Gauge,
  Activity,
} from 'lucide-react';
import {
  detectIntroSegment,
  formatIntroTime,
  getSkipIntroSettings,
  isPlaybackInIntro,
  saveSkipIntroSettings,
  SkipIntroSettings,
} from '../services/introDetection';
import { SkipIntroButton } from './SkipIntroButton';

interface VideoPlayerProps {
  item: JellyfinItem;
  streamUrl: string;
  isOfflinePlayback?: boolean;
  onBack: () => void;
  serverConfig: JellyfinServerConfig;
  availableSubtitles: SubtitleTrack[];
  onOpenSubtitleSettings: () => void;
  subtitleSettings: SubtitleSettings;
  selectedSubtitleTrackId?: string;
  onSelectSubtitleTrack: (trackId?: string) => void;
  onDownloadOffline?: (item: JellyfinItem) => void;
  downloadProgress?: DownloadProgress;
  isItemCached?: boolean;
  nextEpisode?: JellyfinItem | null;
  onPlayNextEpisode?: (nextEpisode: JellyfinItem) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  item,
  streamUrl,
  isOfflinePlayback,
  onBack,
  serverConfig,
  availableSubtitles,
  onOpenSubtitleSettings,
  subtitleSettings,
  selectedSubtitleTrackId,
  onSelectSubtitleTrack,
  onDownloadOffline,
  downloadProgress,
  isItemCached,
  nextEpisode,
  onPlayNextEpisode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressHoverRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.durationSeconds || 0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverPositionRatio, setHoverPositionRatio] = useState<number>(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [chapterNotification, setChapterNotification] = useState<string | null>(null);
  const [centerAnimation, setCenterAnimation] = useState<'play' | 'pause' | null>(null);
  const [seekAnimation, setSeekAnimation] = useState<{ direction: 'left' | 'right'; text: string } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);

  // Autoplay state (synced with subtitleSettings.playNextEpisode global setting)
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(() => {
    if (subtitleSettings?.playNextEpisode !== undefined) {
      return subtitleSettings.playNextEpisode;
    }
    return localStorage.getItem('jellyfin_autoplay_enabled') !== 'false';
  });

  // Keep autoplay state synced when global settings change
  useEffect(() => {
    if (subtitleSettings?.playNextEpisode !== undefined) {
      setIsAutoplayEnabled(subtitleSettings.playNextEpisode);
    }
  }, [subtitleSettings?.playNextEpisode]);

  const [showUpNextOverlay, setShowUpNextOverlay] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [autoplayNotification, setAutoplayNotification] = useState<string | null>(null);

  // ---------------- Adaptive Video Resolution State ----------------
  const [selectedResolution, setSelectedResolution] = useState<VideoResolutionTier>(() => getSavedResolutionPreference());
  const [effectiveResolution, setEffectiveResolution] = useState<Exclude<VideoResolutionTier, 'auto'>>(() => {
    const saved = getSavedResolutionPreference();
    if (saved !== 'auto') return saved;
    return determineResolutionFromBandwidth(getNetworkInfo());
  });
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>(() => {
    if (isOfflinePlayback) return streamUrl;
    const pref = getSavedResolutionPreference();
    const eff = pref === 'auto' ? determineResolutionFromBandwidth(getNetworkInfo()) : pref;
    return getMediaStreamUrl(serverConfig, item, undefined, eff);
  });
  const [showResolutionMenu, setShowResolutionMenu] = useState(false);
  const [isSwitchingResolution, setIsSwitchingResolution] = useState(false);
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkHealthInfo>(() => getNetworkInfo());
  const [nativeVideoSize, setNativeVideoSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  const pendingSeekTimeRef = useRef<number | null>(null);
  const pendingPlayRef = useRef<boolean>(false);
  const stallEventsRef = useRef<number[]>([]);
  const lastAdaptationTimeRef = useRef<number>(0);

  // ---------------- Resume State (localStorage playback position) ----------------
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeCandidate, setResumeCandidate] = useState<PlaybackResumeEntry | null>(null);
  const [hasPromptedResume, setHasPromptedResume] = useState(false);
  const lastSaveTimeRef = useRef<number>(0);
  const lastSavedSecsRef = useRef<number>(0);
  const lastBufferedEndRef = useRef<number>(0);
  const lastMouseMoveRef = useRef<number>(0);

  // ---------------- Skip Intro State ----------------
  const [skipIntroSettings, setSkipIntroSettings] = useState<SkipIntroSettings>(() => getSkipIntroSettings());
  const [introSkipped, setIntroSkipped] = useState(false);
  const [autoSkipCountdown, setAutoSkipCountdown] = useState<number | null>(null);
  const [introToast, setIntroToast] = useState<string | null>(null);

  // Detect intro segment via Jellyfin metadata, chapters, or time interval heuristics
  const introSegment = useMemo(() => {
    return detectIntroSegment(item, duration);
  }, [item, duration]);

  // Is playback currently inside the detected intro?
  const isInsideIntro = useMemo(() => {
    if (!introSegment || introSkipped) return false;
    return isPlaybackInIntro(currentTime, introSegment);
  }, [introSegment, introSkipped, currentTime]);

  // Reset overlay, resume prompt & skip intro when item or stream changes
  useEffect(() => {
    setShowUpNextOverlay(false);
    setCountdown(8);
    setHasPromptedResume(false);
    setShowResumePrompt(false);
    setResumeCandidate(null);
    setIntroSkipped(false);
    setAutoSkipCountdown(null);
    setIntroToast(null);
    lastSaveTimeRef.current = 0;
    lastSavedSecsRef.current = 0;

    if (isOfflinePlayback) {
      setCurrentStreamUrl(streamUrl);
    } else {
      const url = getMediaStreamUrl(serverConfig, item, undefined, effectiveResolution);
      setCurrentStreamUrl(url);
    }
  }, [item.id, streamUrl, isOfflinePlayback, serverConfig, effectiveResolution]);

  // Calculate seconds buffered ahead from current playback time
  const getBufferAheadSeconds = useCallback(() => {
    if (!videoRef.current) return 0;
    const time = videoRef.current.currentTime;
    const buffered = videoRef.current.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= time && buffered.end(i) >= time) {
        return Math.max(0, buffered.end(i) - time);
      }
    }
    return 0;
  }, []);

  // Smoothly applies resolution or bitrate change while preserving position and play state
  const applyResolutionChange = useCallback((
    targetTier: Exclude<VideoResolutionTier, 'auto'>,
    isAutoAdapted: boolean,
    reason?: string
  ) => {
    if (isOfflinePlayback) return;
    setEffectiveResolution(targetTier);

    const newUrl = getMediaStreamUrl(serverConfig, item, undefined, targetTier);
    if (newUrl === currentStreamUrl) return;

    const currentSecs = videoRef.current ? videoRef.current.currentTime : currentTime;
    const wasPlaying = isPlaying;

    pendingSeekTimeRef.current = currentSecs;
    pendingPlayRef.current = wasPlaying;
    setIsSwitchingResolution(true);

    const preset = RESOLUTION_PRESETS[targetTier];
    setQualityToast(
      isAutoAdapted
        ? `Auto-adapted to ${preset.shortLabel} (${reason || 'optimal bitrate'})`
        : `Resolution set to ${preset.label}`
    );

    setCurrentStreamUrl(newUrl);
    lastAdaptationTimeRef.current = Date.now();
  }, [isOfflinePlayback, serverConfig, item, currentStreamUrl, currentTime, isPlaying]);

  // Handles user manual selection of resolution
  const handleSelectResolution = useCallback((tier: VideoResolutionTier) => {
    setSelectedResolution(tier);
    saveResolutionPreference(tier);

    if (tier === 'auto') {
      const autoTier = determineResolutionFromBandwidth(getNetworkInfo());
      applyResolutionChange(autoTier, true, 'Auto detection');
    } else {
      applyResolutionChange(tier, false);
    }
  }, [applyResolutionChange]);

  // Auto-dismiss quality notification toast
  useEffect(() => {
    if (!qualityToast) return;
    const timer = setTimeout(() => setQualityToast(null), 3500);
    return () => clearTimeout(timer);
  }, [qualityToast]);

  // Periodic adaptive resolution check and diagnostics collection
  useEffect(() => {
    const interval = setInterval(() => {
      const isAuto = selectedResolution === 'auto' && isPlaying && !isOfflinePlayback;

      // Only collect detailed video quality diagnostics if the resolution menu is open to save CPU cycles
      if (showResolutionMenu) {
        const net = getNetworkInfo();
        setNetworkInfo(net);

        if (videoRef.current) {
          if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
            setNativeVideoSize({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
          }
          const quality = (videoRef.current as any).getVideoPlaybackQuality?.();
          if (quality) {
            setDroppedFrames(quality.droppedVideoFrames || 0);
            setTotalFrames(quality.totalVideoFrames || 0);
          }
        }
      }

      // Check auto-adaptation
      if (!isAuto) {
        return;
      }

      // Cooldown between auto adaptations (12 seconds)
      const now = Date.now();
      if (now - lastAdaptationTimeRef.current < 12000) {
        return;
      }

      const net = getNetworkInfo();
      const bufferAhead = getBufferAheadSeconds();
      const recentStalls = stallEventsRef.current.filter((t) => now - t < 15000).length;

      const result = computeAdaptiveResolution({
        currentTier: effectiveResolution,
        bufferAheadSeconds: bufferAhead,
        stallCountInWindow: recentStalls,
        network: net,
      });

      if (result.newTier !== effectiveResolution) {
        applyResolutionChange(result.newTier, true, result.reason);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [
    showResolutionMenu,
    selectedResolution,
    isPlaying,
    isOfflinePlayback,
    effectiveResolution,
    getBufferAheadSeconds,
    applyResolutionChange,
  ]);

  // Listen for Skip Intro settings changes
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSkipIntroSettings(getSkipIntroSettings());
    };
    window.addEventListener('jellyfin_skip_intro_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('jellyfin_skip_intro_settings_updated', handleSettingsUpdate);
  }, []);

  // Check saved playback position and prompt user
  const checkAndPromptResume = useCallback(() => {
    if (hasPromptedResume) return;

    // Check localStorage first
    const saved = getPlaybackResume(item.id);
    let candSecs = saved ? saved.positionSeconds : 0;

    // Fallback to Jellyfin server userData if no localStorage entry exists
    if (!candSecs && item.userData?.playbackPositionTicks) {
      candSecs = Math.floor(item.userData.playbackPositionTicks / 10000000);
    }

    const currentDur = videoRef.current?.duration || duration || item.durationSeconds || 0;

    // Only prompt if position is meaningful (>= 5 seconds and not within the last 15 seconds)
    if (candSecs >= 5 && currentDur > 20 && candSecs < currentDur - 15) {
      const entry: PlaybackResumeEntry = {
        itemId: item.id,
        positionSeconds: candSecs,
        durationSeconds: currentDur,
        updatedAt: saved?.updatedAt || Date.now(),
        title: item.name,
        percentage:
          saved?.percentage ||
          Math.min(100, Math.max(1, Math.round((candSecs / currentDur) * 100))),
      };
      setResumeCandidate(entry);
      setShowResumePrompt(true);
      setHasPromptedResume(true);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      setHasPromptedResume(true);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [hasPromptedResume, item.id, item.name, item.durationSeconds, item.userData, duration]);

  // Save current progress to localStorage (throttled to 5 seconds during continuous playback)
  const saveCurrentProgress = useCallback(
    (force = false) => {
      if (!videoRef.current) return;
      const time = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration || item.durationSeconds || 0;
      const now = Date.now();

      if (force || now - lastSaveTimeRef.current >= 5000) {
        if (Math.abs(time - lastSavedSecsRef.current) >= 1 || force) {
          lastSaveTimeRef.current = now;
          lastSavedSecsRef.current = time;
          savePlaybackResume(item.id, time, dur, item.name);
          recordWatchHistory(item, time, dur, false);
        }
      }
    },
    [item, duration]
  );

  // Flush timestamp to localStorage and release hardware video decoder & buffers on unmount
  useEffect(() => {
    const vid = videoRef.current;
    return () => {
      saveCurrentProgress(true);
      if (vid) {
        try {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [saveCurrentProgress]);

  // Resume handlers
  const handleConfirmResume = useCallback(() => {
    if (videoRef.current && resumeCandidate) {
      videoRef.current.currentTime = resumeCandidate.positionSeconds;
      setCurrentTime(resumeCandidate.positionSeconds);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setCenterAnimation('play');
      setTimeout(() => setCenterAnimation(null), 600);
    }
    setShowResumePrompt(false);
  }, [resumeCandidate]);

  const handleStartOver = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      clearPlaybackResume(item.id);
      const dur = videoRef.current.duration || duration || item.durationSeconds || 0;
      recordWatchHistory(item, 0, dur, false);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setCenterAnimation('play');
      setTimeout(() => setCenterAnimation(null), 600);
    }
    setShowResumePrompt(false);
  }, [item, duration]);

  const handleDismissResume = useCallback(() => {
    setShowResumePrompt(false);
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, []);

  // ---------------- Skip Intro Actions ----------------
  const handleSkipIntro = useCallback(() => {
    if (!videoRef.current || !introSegment) return;
    const target = Math.min(duration, introSegment.endSeconds);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    setIntroSkipped(true);
    setAutoSkipCountdown(null);

    const segmentLabel = introSegment.label || 'Opening Credits';
    setIntroToast(`Skipped ${segmentLabel} to ${formatIntroTime(target)}`);
    setTimeout(() => setIntroToast(null), 3500);

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [introSegment, duration]);

  // Auto-skip countdown when autoSkip is enabled in settings and playback is inside intro
  useEffect(() => {
    if (!skipIntroSettings.autoSkip || !isInsideIntro || !introSegment || introSkipped) {
      setAutoSkipCountdown(null);
      return;
    }

    // 2-second countdown before auto skipping
    setAutoSkipCountdown(2);
    const timer = setInterval(() => {
      setAutoSkipCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSkipIntro();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isInsideIntro, introSegment, skipIntroSettings.autoSkip, introSkipped, handleSkipIntro]);

  const toggleAutoSkipIntro = useCallback(() => {
    const updated = saveSkipIntroSettings({ autoSkip: !skipIntroSettings.autoSkip });
    setSkipIntroSettings(updated);
    setIntroToast(
      updated.autoSkip ? 'Auto-Skip Intro: ON' : 'Auto-Skip Intro: OFF'
    );
    setTimeout(() => setIntroToast(null), 2500);
  }, [skipIntroSettings.autoSkip]);

  // Autoplay countdown timer
  useEffect(() => {
    if (!showUpNextOverlay || !nextEpisode) return;

    if (!isAutoplayEnabled) {
      return; // Autoplay is paused
    }

    if (countdown <= 0) {
      setShowUpNextOverlay(false);
      onPlayNextEpisode?.(nextEpisode);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showUpNextOverlay, countdown, isAutoplayEnabled, nextEpisode, onPlayNextEpisode]);

  const toggleAutoplay = useCallback(() => {
    setIsAutoplayEnabled((prev) => {
      const nextVal = !prev;
      localStorage.setItem('jellyfin_autoplay_enabled', String(nextVal));
      setAutoplayNotification(nextVal ? 'Autoplay Enabled' : 'Autoplay Disabled');
      setTimeout(() => setAutoplayNotification(null), 2400);
      return nextVal;
    });
  }, []);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Chapters data sorted by startPositionSeconds
  const sortedChapters = useMemo(() => {
    if (!item.chapters || item.chapters.length === 0) return [];
    return [...item.chapters].sort((a, b) => a.startPositionSeconds - b.startPositionSeconds);
  }, [item.chapters]);

  // Determine active chapter based on current playback time
  const activeChapterIndex = useMemo(() => {
    if (sortedChapters.length === 0) return -1;
    let activeIdx = 0;
    for (let i = 0; i < sortedChapters.length; i++) {
      if (currentTime >= sortedChapters[i].startPositionSeconds) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [sortedChapters, currentTime]);

  const activeChapter = sortedChapters[activeChapterIndex] || null;

  // Chapter corresponding to hover position on seekbar
  const hoveredChapter = useMemo(() => {
    if (sortedChapters.length === 0 || hoverSeekTime === null) return null;
    let match = sortedChapters[0];
    for (const ch of sortedChapters) {
      if (hoverSeekTime >= ch.startPositionSeconds) {
        match = ch;
      } else {
        break;
      }
    }
    return match;
  }, [sortedChapters, hoverSeekTime]);

  // Active Subtitle Track
  const activeSubtitle = availableSubtitles.find(s => s.id === selectedSubtitleTrackId);

  // Format time (seconds -> hh:mm:ss or mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // Reset hide controls timer
  const scheduleHideControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowSubtitleMenu(false);
        setShowChapterMenu(false);
      }
    }, 3500);
  }, []);

  const handleMouseMove = () => {
    const now = Date.now();
    // Throttle mouse movement handling to 150ms to avoid clearing and creating timeouts on every pixel
    if (now - lastMouseMoveRef.current < 150) {
      return;
    }
    lastMouseMoveRef.current = now;
    scheduleHideControls();
  };

  // Chapter jump handlers
  const handleJumpToChapter = (chapter: MediaChapter) => {
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.startPositionSeconds;
      setCurrentTime(chapter.startPositionSeconds);
      if (!isPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
    setShowChapterMenu(false);
    setChapterNotification(`${chapter.name} (${formatTime(chapter.startPositionSeconds)})`);
    setTimeout(() => setChapterNotification(null), 2500);
  };

  const handleNextChapter = () => {
    if (sortedChapters.length === 0) return;
    const nextIdx = Math.min(sortedChapters.length - 1, activeChapterIndex + 1);
    if (nextIdx !== activeChapterIndex) {
      handleJumpToChapter(sortedChapters[nextIdx]);
    }
  };

  const handlePrevChapter = () => {
    if (sortedChapters.length === 0) return;
    if (activeChapter && currentTime - activeChapter.startPositionSeconds > 3) {
      handleJumpToChapter(activeChapter);
    } else {
      const prevIdx = Math.max(0, activeChapterIndex - 1);
      handleJumpToChapter(sortedChapters[prevIdx]);
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (showUpNextOverlay) {
      setShowUpNextOverlay(false);
    }
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setCenterAnimation('play');
    } else {
      videoRef.current.pause();
      setCenterAnimation('pause');
    }
    setTimeout(() => setCenterAnimation(null), 600);
    scheduleHideControls();
  };

  // Seek relative
  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    if (showUpNextOverlay) {
      setShowUpNextOverlay(false);
    }
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    scheduleHideControls();
  };

  // Seek absolute
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressHoverRef.current) return;
    if (showUpNextOverlay) {
      setShowUpNextOverlay(false);
    }
    const rect = progressHoverRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Touch seek for smartphones
  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressHoverRef.current || e.touches.length === 0) return;
    if (showUpNextOverlay) {
      setShowUpNextOverlay(false);
    }
    const rect = progressHoverRef.current.getBoundingClientRect();
    const clientX = e.touches[0].clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Mobile video tap & double-tap to seek handler
  const handleVideoTouchOrClick = (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    if (showResumePrompt) return;
    const now = Date.now();
    let clientX = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || window.innerWidth;
    const relativeX = clientX - (rect?.left || 0);
    const ratio = relativeX / width;

    if (lastTapRef.current && now - lastTapRef.current.time < 320 && Math.abs(clientX - lastTapRef.current.x) < 80) {
      // Double tap detected!
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = null;

      if (ratio < 0.42) {
        // Left side double tap: Rewind 10s
        seekRelative(-10);
        setSeekAnimation({ direction: 'left', text: '10s' });
        setTimeout(() => setSeekAnimation(null), 700);
      } else if (ratio > 0.58) {
        // Right side double tap: Forward 10s
        seekRelative(10);
        setSeekAnimation({ direction: 'right', text: '10s' });
        setTimeout(() => setSeekAnimation(null), 700);
      } else {
        // Center double tap: toggle play
        togglePlay();
      }
    } else {
      // Single tap with timer
      lastTapRef.current = { time: now, x: clientX };
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = window.setTimeout(() => {
        setShowControls((prev) => !prev);
        setShowResolutionMenu(false);
        setShowSubtitleMenu(false);
        setShowSpeedMenu(false);
        setShowChapterMenu(false);
        lastTapRef.current = null;
      }, 280);
    }
  };

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressHoverRef.current) return;
    const rect = progressHoverRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPositionRatio(ratio);
    setHoverSeekTime(ratio * duration);
  };

  const handleSeekMouseLeave = () => {
    setHoverSeekTime(null);
  };

  // Volume Change
  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Speed Change
  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  // Fullscreen with mobile fallback support
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        }
        setIsFullscreen(true);
      } catch {
        // Fullscreen error
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch {
      // PiP not supported or disallowed
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if resume prompt is active (it handles Enter/B/Esc itself)
      if (showResumePrompt) {
        return;
      }

      // Don't trigger shortcuts if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c':
          e.preventDefault();
          if (selectedSubtitleTrackId) {
            onSelectSubtitleTrack(undefined);
          } else if (availableSubtitles.length > 0) {
            onSelectSubtitleTrack(availableSubtitles[0].id);
          }
          break;
        case 's':
          if (isInsideIntro) {
            e.preventDefault();
            handleSkipIntro();
          }
          break;
        case '[':
          e.preventDefault();
          handlePrevChapter();
          break;
        case ']':
          e.preventDefault();
          handleNextChapter();
          break;
        case '>':
          if (e.shiftKey) {
            e.preventDefault();
            const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
            const next = speeds.find(s => s > playbackRate) || 2;
            handleSpeedChange(next);
          }
          break;
        case '<':
          if (e.shiftKey) {
            e.preventDefault();
            const speeds = [2, 1.5, 1.25, 1, 0.75, 0.5];
            const prev = speeds.find(s => s < playbackRate) || 0.5;
            handleSpeedChange(prev);
          }
          break;
        case 'n':
          if (e.shiftKey && nextEpisode && onPlayNextEpisode) {
            e.preventDefault();
            setShowUpNextOverlay(false);
            onPlayNextEpisode(nextEpisode);
          }
          break;
        case 'q':
          e.preventDefault();
          setShowResolutionMenu((prev) => !prev);
          setShowSpeedMenu(false);
          setShowSubtitleMenu(false);
          setShowChapterMenu(false);
          break;
        case 'enter':
          if (showUpNextOverlay && nextEpisode && onPlayNextEpisode) {
            e.preventDefault();
            setShowUpNextOverlay(false);
            onPlayNextEpisode(nextEpisode);
          }
          break;
        case 'h':
          e.preventDefault();
          onBack();
          break;
        case 'escape':
          if (showUpNextOverlay) {
            e.preventDefault();
            setShowUpNextOverlay(false);
          } else if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            onBack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    volume,
    isMuted,
    isFullscreen,
    selectedSubtitleTrackId,
    availableSubtitles,
    duration,
    playbackRate,
    sortedChapters,
    activeChapterIndex,
    currentTime,
    showUpNextOverlay,
    nextEpisode,
    onPlayNextEpisode,
  ]);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    clearPlaybackResume(item.id);
    const dur = videoRef.current?.duration || duration || item.durationSeconds || 0;
    recordWatchHistory(item, dur, dur, true);

    // Report completed/stopped to real Jellyfin server
    const isRealServer =
      !serverConfig.isDemoMode &&
      Boolean(serverConfig.serverUrl) &&
      Boolean(serverConfig.accessToken);
    if (isRealServer && !isOfflinePlayback) {
      reportPlaybackProgress(serverConfig, item.id, dur, false);
      reportPlaybackStopped(serverConfig, item.id, dur);
    }

    if (nextEpisode) {
      setCountdown(8);
      setShowUpNextOverlay(true);
    }
  };

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    // Update buffer progress only if buffer changed by >= 0.5s to avoid excessive re-renders
    if (videoRef.current.buffered.length > 0) {
      const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      if (Math.abs(end - lastBufferedEndRef.current) >= 0.5) {
        lastBufferedEndRef.current = end;
        setBufferedEnd(end);
      }
    }

    // Save playback position periodically to localStorage
    saveCurrentProgress(false);
  };

  // Periodic Jellyfin watch progress sync timer (active when connected to a real Jellyfin server)
  useEffect(() => {
    // Only send if the user is connected to a real Jellyfin server (not demo mode or offline)
    const isRealServer =
      !serverConfig.isDemoMode &&
      Boolean(serverConfig.serverUrl) &&
      Boolean(serverConfig.accessToken);

    if (!isRealServer || isOfflinePlayback) {
      return;
    }

    // Notify Jellyfin server that playback session has started
    const initialPos = videoRef.current ? videoRef.current.currentTime : 0;
    reportPlaybackStart(serverConfig, item.id, initialPos);

    // Periodic timer every 10 seconds to keep cross-device playback progress synced
    const interval = setInterval(() => {
      if (videoRef.current) {
        reportPlaybackProgress(
          serverConfig,
          item.id,
          videoRef.current.currentTime,
          videoRef.current.paused
        );
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      // When leaving player, notify server of final position and session stop
      if (videoRef.current) {
        reportPlaybackStopped(serverConfig, item.id, videoRef.current.currentTime);
      }
    };
  }, [serverConfig, item.id, isOfflinePlayback]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={() => {
        if (!showControls) setShowControls(true);
      }}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={currentStreamUrl}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || item.durationSeconds || 0);
            if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
              setNativeVideoSize({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
            }
            if (pendingSeekTimeRef.current !== null) {
              videoRef.current.currentTime = pendingSeekTimeRef.current;
              pendingSeekTimeRef.current = null;
            }
            if (pendingPlayRef.current) {
              videoRef.current.play().catch(() => {});
              pendingPlayRef.current = false;
            }
            setIsLoading(false);
            setIsSwitchingResolution(false);
            checkAndPromptResume();
          }
        }}
        onCanPlay={() => {
          if (pendingSeekTimeRef.current !== null && videoRef.current) {
            videoRef.current.currentTime = pendingSeekTimeRef.current;
            pendingSeekTimeRef.current = null;
          }
          if (pendingPlayRef.current && videoRef.current) {
            videoRef.current.play().catch(() => {});
            pendingPlayRef.current = false;
          }
          setIsLoading(false);
          setIsSwitchingResolution(false);
        }}
        onWaiting={() => {
          setIsLoading(true);
          const now = Date.now();
          stallEventsRef.current = [...stallEventsRef.current.filter((t) => now - t < 20000), now];
        }}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
          const isRealServer =
            !serverConfig.isDemoMode &&
            Boolean(serverConfig.serverUrl) &&
            Boolean(serverConfig.accessToken);
          if (isRealServer && !isOfflinePlayback && videoRef.current) {
            reportPlaybackProgress(
              serverConfig,
              item.id,
              videoRef.current.currentTime,
              false
            );
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
          saveCurrentProgress(true);
          const isRealServer =
            !serverConfig.isDemoMode &&
            Boolean(serverConfig.serverUrl) &&
            Boolean(serverConfig.accessToken);
          if (isRealServer && !isOfflinePlayback && videoRef.current) {
            reportPlaybackProgress(
              serverConfig,
              item.id,
              videoRef.current.currentTime,
              true
            );
          }
        }}
        onEnded={handleVideoEnded}
        onClick={handleVideoTouchOrClick}
        className="w-full h-full object-contain cursor-pointer touch-manipulation select-none"
      />

      {/* Subtitle Overlay */}
      <SubtitleOverlay
        cues={activeSubtitle?.cues}
        currentTime={currentTime}
        settings={subtitleSettings}
        isVisible={Boolean(selectedSubtitleTrackId)}
      />

      {/* Quality & Adaptive Resolution Notification */}
      {qualityToast && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md text-white font-medium text-xs sm:text-sm border border-indigo-500/50 shadow-2xl">
            <Gauge className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{qualityToast}</span>
          </div>
        </div>
      )}

      {/* Non-blocking Resolution Switching Indicator */}
      {isSwitchingResolution && (
        <div className="pointer-events-none absolute top-28 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-indigo-500/40 shadow-2xl text-white text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>Adapting stream resolution...</span>
          </div>
        </div>
      )}

      {/* Autoplay Toast Notification */}
      {autoplayNotification && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md text-white font-medium text-xs sm:text-sm border border-indigo-500/50 shadow-2xl">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{autoplayNotification}</span>
          </div>
        </div>
      )}

      {/* Chapter Jump Notification */}
      {chapterNotification && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md text-white font-medium text-xs sm:text-sm border border-neutral-700 shadow-2xl">
            <Bookmark className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{chapterNotification}</span>
          </div>
        </div>
      )}

      {/* Intro Skipped / Jump Notification */}
      {introToast && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-black/90 backdrop-blur-md text-white font-medium text-xs sm:text-sm border border-amber-500/50 shadow-2xl">
            <FastForward className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{introToast}</span>
          </div>
        </div>
      )}

      {/* Floating Skip Intro Button during Intro Segment */}
      {isInsideIntro && introSegment && (
        <SkipIntroButton
          introSegment={introSegment}
          currentTime={currentTime}
          onSkip={handleSkipIntro}
          autoSkipCountdown={autoSkipCountdown}
          autoSkipEnabled={skipIntroSettings.autoSkip}
          onToggleAutoSkip={toggleAutoSkipIntro}
        />
      )}

      {/* Up Next / Autoplay Overlay */}
      {showUpNextOverlay && nextEpisode && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="relative max-w-lg w-full bg-neutral-900/95 border border-neutral-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden flex flex-col space-y-5">
            {/* Top row: Series header & close button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <Tv className="w-4 h-4" />
                <span>Up Next {nextEpisode.seriesName ? `in ${nextEpisode.seriesName}` : ''}</span>
              </div>
              <button
                onClick={() => setShowUpNextOverlay(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                title="Cancel Autoplay (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thumbnail + Episode Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-full sm:w-44 aspect-video rounded-xl bg-neutral-950 overflow-hidden flex-shrink-0 border border-neutral-800 group">
                {nextEpisode.backdropImageUrl || nextEpisode.primaryImageUrl ? (
                  <img
                    src={nextEpisode.backdropImageUrl || nextEpisode.primaryImageUrl}
                    alt={nextEpisode.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-950">
                    <Tv className="w-6 h-6" />
                  </div>
                )}
                {/* Play hover button */}
                <button
                  onClick={() => {
                    setShowUpNextOverlay(false);
                    onPlayNextEpisode?.(nextEpisode);
                  }}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/20 transition cursor-pointer"
                  title="Play Episode Now"
                >
                  <div className="p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/50 transform group-hover:scale-110 transition">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                {(nextEpisode.parentIndexNumber || nextEpisode.indexNumber) && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-xs font-semibold">
                    {nextEpisode.parentIndexNumber ? `Season ${nextEpisode.parentIndexNumber} • ` : ''}Episode {nextEpisode.indexNumber ?? 1}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white truncate" title={nextEpisode.name}>
                  {nextEpisode.name}
                </h3>
                {nextEpisode.overview && (
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                    {nextEpisode.overview}
                  </p>
                )}
                <div className="flex items-center space-x-3 text-xs text-neutral-400 pt-0.5">
                  {nextEpisode.durationSeconds && (
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>{Math.round(nextEpisode.durationSeconds / 60)} min</span>
                    </span>
                  )}
                  {nextEpisode.productionYear && <span>{nextEpisode.productionYear}</span>}
                </div>
              </div>
            </div>

            {/* Countdown / Status Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                {isAutoplayEnabled ? (
                  <div className="flex items-center space-x-2 text-neutral-300 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span>Playing next episode in <strong className="text-indigo-400 font-mono text-sm">{countdown}s</strong></span>
                  </div>
                ) : (
                  <span className="text-neutral-400">Autoplay paused — click Play Now to begin</span>
                )}

                <button
                  onClick={toggleAutoplay}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 transition"
                >
                  <span>Autoplay: <strong>{isAutoplayEnabled ? 'ON' : 'OFF'}</strong></span>
                </button>
              </div>

              {/* Animated Progress bar */}
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{
                    width: isAutoplayEnabled ? `${((8 - countdown) / 8) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowUpNextOverlay(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowUpNextOverlay(false);
                  onPlayNextEpisode?.(nextEpisode);
                }}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition transform hover:scale-[1.02]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Animated Splash Feedback */}
      {centerAnimation && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
          <div className="p-6 rounded-full bg-black/60 backdrop-blur-md text-white animate-scaleUp">
            {centerAnimation === 'play' ? (
              <Play className="w-12 h-12 fill-current" />
            ) : (
              <Pause className="w-12 h-12 fill-current" />
            )}
          </div>
        </div>
      )}

      {/* Mobile Double Tap Seek Feedback */}
      {seekAnimation && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center p-5 sm:p-6 rounded-full bg-black/80 backdrop-blur-md text-white border border-indigo-500/50 shadow-2xl animate-scaleUp ${
            seekAnimation.direction === 'left' ? 'left-6 sm:left-24' : 'right-6 sm:right-24'
          }`}
        >
          {seekAnimation.direction === 'left' ? (
            <>
              <RotateCcw className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400 mb-1" />
              <span className="text-xs font-bold font-mono text-indigo-200">-{seekAnimation.text}</span>
            </>
          ) : (
            <>
              <RotateCw className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400 mb-1" />
              <span className="text-xs font-bold font-mono text-indigo-200">+{seekAnimation.text}</span>
            </>
          )}
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
          <div className="flex flex-col items-center space-y-3 bg-black/50 p-5 rounded-2xl backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <span className="text-xs text-neutral-300 font-medium">Buffering video stream...</span>
          </div>
        </div>
      )}

      {/* ----------------- Top Control Bar ----------------- */}
      <div
        className={`absolute top-0 left-0 right-0 px-3 sm:px-6 py-2.5 sm:py-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
          <button
            id="player-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition backdrop-blur-sm"
            title="Back to library (Esc)"
            aria-label="Back to library"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            id="player-home-btn"
            onClick={onBack}
            className="flex items-center space-x-1.5 p-2 px-2.5 sm:px-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition backdrop-blur-sm border border-neutral-700/50"
            title="Return to Home (H)"
            aria-label="Return to Home"
          >
            <Home className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline text-xs font-semibold text-neutral-200">Home</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-white truncate max-w-[170px] xs:max-w-[240px] sm:max-w-md">
              {item.name}
            </h1>
            <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-neutral-300 mt-0.5">
              {item.productionYear && <span>{item.productionYear}</span>}
              {isOfflinePlayback ? (
                <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium text-[10px]">
                  <Radio className="w-3 h-3" />
                  <span>Offline Storage</span>
                </span>
              ) : (
                <span className="text-neutral-400">Direct Stream</span>
              )}
            </div>
          </div>
        </div>

        {/* Top Right Action items */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Download button for offline caching */}
          {!isOfflinePlayback && onDownloadOffline && (
            <button
              onClick={() => onDownloadOffline(item)}
              disabled={isItemCached || (downloadProgress && downloadProgress.status === 'downloading')}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-sm transition ${
                isItemCached
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : downloadProgress?.status === 'downloading'
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/60'
              }`}
            >
              {isItemCached ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Cached Offline</span>
                </>
              ) : downloadProgress?.status === 'downloading' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{downloadProgress.percent}%</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">Cache Offline</span>
                </>
              )}
            </button>
          )}

          {/* Subtitle Settings quick button */}
          <button
            onClick={onOpenSubtitleSettings}
            className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium backdrop-blur-sm border border-neutral-700/60 transition"
            title="Subtitle Sync & Style"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Subtitle Settings</span>
          </button>
        </div>
      </div>

      {/* ----------------- Bottom Controls ----------------- */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 sm:px-6 py-3 sm:py-6 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col z-30 transition-opacity duration-300 space-y-2.5 sm:space-y-3 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress / Seekbar with touch scrubbing */}
        <div className="relative group flex items-center py-2.5 sm:py-2 cursor-pointer touch-none">
          <div
            ref={progressHoverRef}
            onClick={handleSeek}
            onTouchStart={handleTouchSeek}
            onTouchMove={handleTouchSeek}
            onMouseMove={handleSeekMouseMove}
            onMouseLeave={handleSeekMouseLeave}
            className="w-full h-2 group-hover:h-3 sm:h-1.5 sm:group-hover:h-2.5 bg-neutral-700/60 rounded-full relative overflow-hidden transition-all duration-150"
          >
            {/* Buffered bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-neutral-500/40 rounded-full transition-all duration-200"
              style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }}
            />
            {/* Played progress bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-indigo-500 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* Chapter Breakpoint tick marks */}
            {sortedChapters.map((ch, idx) => {
              if (idx === 0 || duration <= 0) return null;
              const pct = Math.min(99.6, Math.max(0.4, (ch.startPositionSeconds / duration) * 100));
              return (
                <div
                  key={ch.id || idx}
                  className="absolute top-0 bottom-0 w-[2px] bg-neutral-950/80 z-10 pointer-events-none"
                  style={{ left: `${pct}%` }}
                  title={`${ch.name} (${formatTime(ch.startPositionSeconds)})`}
                />
              );
            })}

            {/* Intro segment highlight on progress bar */}
            {introSegment && duration > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-amber-400/40 border-l border-r border-amber-300 z-12 pointer-events-none"
                style={{
                  left: `${Math.max(0, Math.min(100, (introSegment.startSeconds / duration) * 100))}%`,
                  width: `${Math.max(0.5, Math.min(100, ((introSegment.endSeconds - introSegment.startSeconds) / duration) * 100))}%`,
                }}
                title={`Opening credits: ${formatIntroTime(introSegment.startSeconds)} - ${formatIntroTime(introSegment.endSeconds)}`}
              />
            )}

            {/* Saved resume position tick mark */}
            {resumeCandidate && duration > 0 && resumeCandidate.positionSeconds > 0 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 z-15 shadow-sm shadow-amber-500/50 pointer-events-none"
                style={{
                  left: `${Math.min(99.5, Math.max(0.5, (resumeCandidate.positionSeconds / duration) * 100))}%`,
                }}
                title={`Saved resume point: ${formatTime(resumeCandidate.positionSeconds)}`}
              />
            )}
          </div>

          {/* Hover Time & Chapter Tooltip */}
          {hoverSeekTime !== null && (
            <div
              className="absolute -top-8 transform -translate-x-1/2 px-2.5 py-1 rounded-lg bg-neutral-900/95 backdrop-blur-md text-white text-[11px] font-medium border border-neutral-700 pointer-events-none shadow-xl flex items-center space-x-1.5 whitespace-nowrap z-40 animate-fadeIn"
              style={{ left: `${Math.min(92, Math.max(8, hoverPositionRatio * 100))}%` }}
            >
              <span className="font-mono text-indigo-300 font-semibold">{formatTime(hoverSeekTime)}</span>
              {introSegment && hoverSeekTime >= introSegment.startSeconds && hoverSeekTime <= introSegment.endSeconds && (
                <>
                  <span className="text-neutral-500">•</span>
                  <span className="text-amber-300 font-semibold flex items-center space-x-1">
                    <FastForward className="w-3 h-3 text-amber-400" />
                    <span>{introSegment.label || 'Opening Credits'}</span>
                  </span>
                </>
              )}
              {hoveredChapter && (
                <>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-200 truncate max-w-[200px]">{hoveredChapter.name}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center justify-between">
          {/* Left: Play, Skips, Volume, Time & Chapter Badge */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            <button
              onClick={() => seekRelative(-10)}
              className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition"
              title="Rewind 10 seconds (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition"
              title="Forward 10 seconds (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Next Episode Button */}
            {nextEpisode && onPlayNextEpisode && (
              <button
                onClick={() => {
                  setShowUpNextOverlay(false);
                  onPlayNextEpisode(nextEpisode);
                }}
                className="p-2 text-neutral-300 hover:text-indigo-400 rounded-lg hover:bg-neutral-800/80 transition"
                title={`Next Episode: ${nextEpisode.name} (Shift + N)`}
              >
                <SkipForward className="w-4 h-4 text-indigo-400" />
              </button>
            )}

            {/* Volume Control */}
            <div className="flex items-center space-x-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1.5 accent-indigo-500 bg-neutral-700/80 rounded-lg cursor-pointer transition-all"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs font-mono text-neutral-300 pl-1 flex items-center">
              <span>{formatTime(currentTime)}</span>
              <span className="text-neutral-500 mx-1">/</span>
              <span className="text-neutral-400">{formatTime(duration)}</span>
            </div>

            {/* Active Chapter indicator badge button */}
            {activeChapter && (
              <button
                onClick={() => {
                  setShowChapterMenu(!showChapterMenu);
                  setShowResolutionMenu(false);
                  setShowSubtitleMenu(false);
                  setShowSpeedMenu(false);
                }}
                className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-200 text-xs border border-neutral-700/60 transition group max-w-[220px]"
                title="Current Scene (Click to browse scenes)"
              >
                <Bookmark className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="font-medium truncate">{activeChapter.name}</span>
                <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </button>
            )}

            {/* Quick jump to saved resume position button */}
            {resumeCandidate && Math.abs(currentTime - resumeCandidate.positionSeconds) > 15 && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = resumeCandidate.positionSeconds;
                    setCurrentTime(resumeCandidate.positionSeconds);
                  }
                }}
                className="hidden xl:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                title={`Jump to saved position (${formatTime(resumeCandidate.positionSeconds)})`}
              >
                <Bookmark className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>Resume {formatTime(resumeCandidate.positionSeconds)}</span>
              </button>
            )}
          </div>

          {/* Right: Chapters, Subtitles, Speed, PiP, Fullscreen */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 relative">
            
            {/* Chapters List Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowChapterMenu(!showChapterMenu);
                  setShowResolutionMenu(false);
                  setShowSubtitleMenu(false);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  showChapterMenu
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : sortedChapters.length > 0
                    ? 'bg-neutral-900/80 border-neutral-700/60 text-neutral-200 hover:text-white hover:bg-neutral-800'
                    : 'bg-neutral-900/30 border-neutral-800/40 text-neutral-500 cursor-not-allowed'
                }`}
                title={sortedChapters.length > 0 ? "Scenes & Chapters ([ / ])" : "No chapters available"}
                aria-label="Chapters"
                disabled={sortedChapters.length === 0}
              >
                <ListVideo className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Chapters</span>
                {sortedChapters.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] text-indigo-300 font-mono">
                    {sortedChapters.length}
                  </span>
                )}
              </button>

              {showChapterMenu && (
                <div className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:absolute sm:bottom-12 sm:right-0 w-auto sm:w-84 max-h-[70vh] bg-neutral-900/98 sm:bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl p-2.5 z-50 text-xs animate-fadeIn overflow-hidden flex flex-col">
                  {/* Chapter Menu Header */}
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <ListVideo className="w-4 h-4 text-indigo-400" />
                      <span className="font-semibold text-white">Scenes & Chapters</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={handlePrevChapter}
                        className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                        title="Previous Chapter ([)"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleNextChapter}
                        className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                        title="Next Chapter (])"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] text-neutral-400 font-mono pl-1">
                        {sortedChapters.length} scenes
                      </span>
                    </div>
                  </div>

                  {/* Intro segment banner */}
                  {introSegment && (
                    <div className="mx-1 mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5 text-amber-300 font-semibold text-[11px]">
                          <FastForward className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                          <span className="truncate">{introSegment.label || 'Opening Credits'}</span>
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          {formatIntroTime(introSegment.startSeconds)} → {formatIntroTime(introSegment.endSeconds)}
                          {introSegment.source && (
                            <span className="text-neutral-500 ml-1">({introSegment.source})</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleSkipIntro();
                          setShowChapterMenu(false);
                        }}
                        disabled={currentTime >= introSegment.endSeconds}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 flex-shrink-0 transition ${
                          currentTime >= introSegment.endSeconds
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                        }`}
                        title="Jump past opening credits"
                      >
                        <FastForward className="w-3 h-3" />
                        <span>{currentTime >= introSegment.endSeconds ? 'Passed' : 'Skip Intro'}</span>
                      </button>
                    </div>
                  )}

                  {/* Chapter List items */}
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {sortedChapters.map((chapter, index) => {
                      const isCurrent = activeChapterIndex === index;
                      return (
                        <button
                          key={chapter.id || index}
                          onClick={() => handleJumpToChapter(chapter)}
                          className={`w-full flex items-center space-x-2.5 p-2 rounded-xl text-left transition group ${
                            isCurrent
                              ? 'bg-indigo-600/20 border border-indigo-500/40 text-white font-medium'
                              : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white border border-transparent'
                          }`}
                        >
                          {/* Chapter thumbnail or number badge */}
                          {chapter.imageUrl ? (
                            <div className="relative w-14 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800 border border-neutral-700">
                              <img
                                src={chapter.imageUrl}
                                alt={chapter.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                              {isCurrent && (
                                <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
                              )}
                            </div>
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[11px] flex-shrink-0 ${
                                isCurrent
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'bg-neutral-800 text-neutral-400 group-hover:text-neutral-200'
                              }`}
                            >
                              {String(index + 1).padStart(2, '0')}
                            </div>
                          )}

                          {/* Chapter Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`truncate text-xs ${isCurrent ? 'text-indigo-200 font-semibold' : 'text-neutral-200'}`}>
                                {chapter.name}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-semibold ml-1 flex-shrink-0">
                                  Playing
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400 mt-0.5 font-mono">
                              <Clock className="w-3 h-3 text-neutral-500" />
                              <span>{formatTime(chapter.startPositionSeconds)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Subtitles Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSubtitleMenu(!showSubtitleMenu);
                  setShowResolutionMenu(false);
                  setShowSpeedMenu(false);
                  setShowChapterMenu(false);
                }}
                className={`p-2 rounded-lg transition ${
                  selectedSubtitleTrackId
                    ? 'text-indigo-400 bg-indigo-500/20'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                }`}
                title="Subtitles (C)"
              >
                <Subtitles className="w-5 h-5" />
              </button>

              {showSubtitleMenu && (
                <div className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:absolute sm:bottom-12 sm:right-0 w-auto sm:w-64 max-h-[70vh] bg-neutral-900/98 sm:bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-1 animate-fadeIn overflow-hidden flex flex-col">
                  <div className="px-2 py-1 font-semibold text-neutral-400 uppercase tracking-wider text-[10px] flex justify-between items-center">
                    <span>Subtitle Tracks</span>
                    <button
                      onClick={() => {
                        setShowSubtitleMenu(false);
                        onOpenSubtitleSettings();
                      }}
                      className="text-indigo-400 hover:underline capitalize"
                    >
                      Settings
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      onSelectSubtitleTrack(undefined);
                      setShowSubtitleMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                      !selectedSubtitleTrackId
                        ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    Off
                  </button>
                  {availableSubtitles.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        onSelectSubtitleTrack(track.id);
                        setShowSubtitleMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg truncate transition flex items-center justify-between ${
                        selectedSubtitleTrackId === track.id
                          ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                          : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate">{track.label}</span>
                      {track.source === 'file' && (
                        <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 ml-1">
                          File
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="pt-1 border-t border-neutral-800">
                    <button
                      onClick={() => {
                        setShowSubtitleMenu(false);
                        onOpenSubtitleSettings();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-indigo-400 hover:bg-neutral-800 flex items-center space-x-1.5 font-medium"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Upload / Customize Subtitles</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Video Resolution & Adaptive Quality Selector Trigger */}
            <div className="relative">
              <button
                id="video-resolution-trigger-btn"
                onClick={() => {
                  setShowResolutionMenu(!showResolutionMenu);
                  setShowSpeedMenu(false);
                  setShowSubtitleMenu(false);
                  setShowChapterMenu(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition ${
                  showResolutionMenu
                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                    : 'text-neutral-300 hover:text-white bg-neutral-900/60 border-neutral-700/60 hover:bg-neutral-800'
                }`}
                title="Video Resolution & Adaptive Quality (Q)"
                aria-label="Resolution Settings"
              >
                <Gauge className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="font-mono">
                  {selectedResolution === 'auto'
                    ? `Auto (${RESOLUTION_PRESETS[effectiveResolution]?.shortLabel || effectiveResolution})`
                    : RESOLUTION_PRESETS[selectedResolution]?.shortLabel || selectedResolution}
                </span>
                {selectedResolution === 'auto' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Adaptive mode active" />
                )}
              </button>

              {showResolutionMenu && (
                <ResolutionMenu
                  selectedResolution={selectedResolution}
                  effectiveResolution={effectiveResolution}
                  onSelectResolution={handleSelectResolution}
                  onClose={() => setShowResolutionMenu(false)}
                  networkInfo={networkInfo}
                  bufferAheadSeconds={getBufferAheadSeconds()}
                  nativeVideoSize={nativeVideoSize}
                  droppedFrames={droppedFrames}
                  totalFrames={totalFrames}
                  isOfflinePlayback={isOfflinePlayback}
                />
              )}
            </div>

            {/* Playback Speed Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowResolutionMenu(false);
                  setShowSubtitleMenu(false);
                  setShowChapterMenu(false);
                }}
                className="px-2 py-1 text-xs font-semibold text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:absolute sm:bottom-12 sm:right-0 w-auto sm:w-36 bg-neutral-900/98 sm:bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-0.5 animate-fadeIn">
                  <div className="px-2 py-1 font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">
                    Speed
                  </div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                        playbackRate === speed
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {speed}x {speed === 1 && '(Normal)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Autoplay Toggle Control */}
            <button
              onClick={toggleAutoplay}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                isAutoplayEnabled
                  ? 'bg-indigo-600/25 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/35'
                  : 'bg-neutral-900/80 border-neutral-700/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
              title={`Autoplay Next Episode: ${isAutoplayEnabled ? 'Enabled' : 'Disabled'}`}
              aria-label="Toggle Autoplay"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAutoplayEnabled ? 'text-indigo-400' : 'text-neutral-500'}`} />
              <span className="hidden md:inline">Autoplay</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${
                  isAutoplayEnabled ? 'bg-indigo-500/30 text-indigo-200 font-bold' : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {isAutoplayEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Skip Intro Toolbar Button */}
            {introSegment && (
              <button
                onClick={handleSkipIntro}
                disabled={currentTime >= introSegment.endSeconds}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  isInsideIntro
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30 animate-pulse'
                    : currentTime < introSegment.startSeconds
                    ? 'bg-neutral-900/80 border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800'
                    : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-500 cursor-not-allowed'
                }`}
                title={
                  isInsideIntro
                    ? "Skip Intro Now (Press 'S')"
                    : currentTime < introSegment.startSeconds
                    ? `Jump past intro (${formatIntroTime(introSegment.startSeconds)} - ${formatIntroTime(introSegment.endSeconds)})`
                    : "Opening credits finished"
                }
                aria-label="Skip Intro"
              >
                <FastForward className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden md:inline">Skip Intro</span>
                {isInsideIntro && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-black/20 text-black uppercase">
                    Now
                  </span>
                )}
              </button>
            )}

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition hidden sm:block"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/80 transition"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resume Playback Prompt Modal */}
      {showResumePrompt && resumeCandidate && (
        <ResumePromptModal
          itemName={item.name}
          seriesName={item.seriesName}
          episodeInfo={
            item.parentIndexNumber || item.indexNumber
              ? `${item.parentIndexNumber ? `Season ${item.parentIndexNumber}, ` : ''}Episode ${item.indexNumber ?? 1}`
              : undefined
          }
          resumeSeconds={resumeCandidate.positionSeconds}
          durationSeconds={resumeCandidate.durationSeconds}
          percentage={resumeCandidate.percentage}
          onResume={handleConfirmResume}
          onStartOver={handleStartOver}
          onDismiss={handleDismissResume}
        />
      )}
    </div>
  );
};
