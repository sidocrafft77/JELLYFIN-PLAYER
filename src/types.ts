export interface JellyfinServerConfig {
  serverUrl: string;
  username: string;
  accessToken?: string;
  userId?: string;
  serverId?: string;
  serverName?: string;
  isDemoMode?: boolean;
}

export interface MediaStreamInfo {
  index: number;
  type: 'Video' | 'Audio' | 'Subtitle';
  codec?: string;
  language?: string;
  displayTitle?: string;
  isDefault?: boolean;
  isForced?: boolean;
  isExternal?: boolean;
  height?: number;
  width?: number;
  bitRate?: number;
}

export interface MediaChapter {
  id?: string;
  name: string;
  startPositionTicks?: number;
  startPositionSeconds: number;
  imageTag?: string;
  imageUrl?: string;
}

export interface IntroSegment {
  startSeconds: number;
  endSeconds: number;
  source: 'metadata' | 'chapter' | 'interval' | 'plugin';
  label: string;
}

export interface JellyfinItem {
  id: string;
  name: string;
  originalTitle?: string;
  overview?: string;
  type: 'Movie' | 'Episode' | 'Video' | 'Series' | 'Season' | 'Folder' | 'CollectionFolder' | 'UserView' | 'BoxSet' | string;
  runTimeTicks?: number; // 10,000 ticks = 1 ms
  durationSeconds?: number;
  productionYear?: number;
  communityRating?: number;
  genres?: string[];
  backdropImageUrl?: string;
  primaryImageUrl?: string;
  bannerImageUrl?: string;
  imdbId?: string;
  imdbUrl?: string;
  imdbRating?: number;
  mediaStreams?: MediaStreamInfo[];
  chapters?: MediaChapter[];
  introSegment?: IntroSegment;
  introStartPositionTicks?: number;
  introEndPositionTicks?: number;
  mediaSources?: Array<{
    id: string;
    container?: string;
    size?: number;
    bitrate?: number;
  }>;
  userData?: {
    playbackPositionTicks?: number;
    playedPercentage?: number;
    isFavorite?: boolean;
    played?: boolean;
  };
  // Series and Episode metadata
  seriesName?: string;
  seriesId?: string;
  seasonName?: string;
  seasonId?: string;
  indexNumber?: number; // Episode number
  parentIndexNumber?: number; // Season number
  // Folder / Collection / View metadata
  isFolder?: boolean;
  collectionType?: string; // e.g. 'movies', 'tvshows', 'homevideos', 'folders', 'boxsets'
  childCount?: number;
  itemCounts?: {
    movieCount?: number;
    seriesCount?: number;
    episodeCount?: number;
    folderCount?: number;
  };
  parentId?: string;
  dateCreated?: string;
  // For offline items
  isOfflineCached?: boolean;
  offlineBlobSize?: number;
}

export type VideoResolutionTier = 'auto' | '1080p' | '720p' | '480p' | '360p' | 'original';

export interface VideoResolutionOption {
  id: VideoResolutionTier;
  label: string;
  shortLabel: string;
  maxHeight?: number;
  maxWidth?: number;
  videoBitRate?: number; // in bps
  badge?: string;
  description: string;
}

export type MediaSortOption = 'recently_added' | 'alphabetical' | 'release_year';

export interface FolderBreadcrumb {
  id: string;
  name: string;
  type?: string;
  collectionType?: string;
}

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language?: string;
  source: 'jellyfin' | 'custom' | 'file' | 'embedded';
  format: 'srt' | 'vtt' | 'ass' | 'sub';
  url?: string;
  rawText?: string;
  cues?: SubtitleCue[];
  isDefault?: boolean;
}

export interface SubtitleSettings {
  fontSize: number; // in pixels, default 24
  textColor: string; // hex, default #FFFFFF
  backgroundColor: string; // hex or rgba, default rgba(0,0,0,0.6)
  backgroundOpacity: number; // 0 to 1
  hasOutline: boolean;
  outlineColor: string;
  offsetSeconds: number; // timing sync adjustment in seconds (+/-)
  position: 'bottom' | 'middle' | 'top';
  lineHeight: number;
  fontFamily: string;
  playNextEpisode?: boolean; // Global setting to enable or disable automatic playback of the next episode in a series
}

export interface CachedOfflineMedia {
  id: string;
  name: string;
  overview?: string;
  type: 'Movie' | 'Episode' | 'Video' | string;
  durationSeconds: number;
  productionYear?: number;
  genres?: string[];
  cachedAt: number; // timestamp
  videoBlob: Blob;
  mimeType: string;
  fileSizeBytes: number;
  posterBlob?: Blob;
  posterUrl?: string; // object URL or data URL
  subtitles: Array<{
    id: string;
    label: string;
    language?: string;
    rawText: string;
    format: 'srt' | 'vtt';
  }>;
  chapters?: MediaChapter[];
  introSegment?: IntroSegment;
  seriesName?: string;
  seriesId?: string;
  seasonName?: string;
  seasonId?: string;
  indexNumber?: number;
  parentIndexNumber?: number;
}

export interface DownloadProgress {
  itemId: string;
  itemName: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBps?: number;
  error?: string;
}

export type ThemeMode = 'day' | 'night';
