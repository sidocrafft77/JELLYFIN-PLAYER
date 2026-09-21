import { JellyfinItem, JellyfinServerConfig, MediaStreamInfo, VideoResolutionTier } from '../types';
import { RESOLUTION_PRESETS } from './adaptiveResolution';
import { enrichItemWithImdbBanner } from './imdbBannerService';

const CLIENT_NAME = 'Jellyfin Web Player';
const DEVICE_NAME = 'Web Browser';
const APP_VERSION = '1.0.0';

function getDeviceId(): string {
  let id = localStorage.getItem('jellyfin_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('jellyfin_device_id', id);
  }
  return id;
}

function getAuthHeader(token?: string): string {
  let header = `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${getDeviceId()}", Version="${APP_VERSION}"`;
  if (token) {
    header += `, Token="${token}"`;
  }
  return header;
}

export function cleanServerUrl(url: string): string {
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'http://' + clean;
  }
  return clean.replace(/\/+$/, '');
}

/**
 * Tests connection to a Jellyfin server
 */
export async function testJellyfinConnection(serverUrl: string): Promise<{
  success: boolean;
  serverName?: string;
  version?: string;
  id?: string;
  error?: string;
}> {
  const cleanUrl = cleanServerUrl(serverUrl);
  try {
    const res = await fetch(`${cleanUrl}/System/Info/Public`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Emby-Authorization': getAuthHeader(),
      },
    });

    if (!res.ok) {
      return { success: false, error: `Server returned status ${res.status}: ${res.statusText}` };
    }

    const data = await res.json();
    return {
      success: true,
      serverName: data.ServerName || 'Jellyfin Server',
      version: data.Version,
      id: data.Id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Could not connect to server. Check CORS settings or URL format.',
    };
  }
}

/**
 * Authenticate with Jellyfin via username and password
 */
export async function authenticateByName(
  serverUrl: string,
  username: string,
  password?: string
): Promise<{
  success: boolean;
  config?: JellyfinServerConfig;
  error?: string;
}> {
  const cleanUrl = cleanServerUrl(serverUrl);
  try {
    const res = await fetch(`${cleanUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Emby-Authorization': getAuthHeader(),
      },
      body: JSON.stringify({
        Username: username.trim(),
        Pw: password || '',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        success: false,
        error: errData?.message || `Authentication failed (${res.status}): Please check username and password.`,
      };
    }

    const data = await res.json();
    const config: JellyfinServerConfig = {
      serverUrl: cleanUrl,
      username: data.User?.Name || username,
      accessToken: data.AccessToken,
      userId: data.User?.Id,
      serverId: data.ServerId,
      serverName: data.ServerName,
      isDemoMode: false,
    };

    return { success: true, config };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error during authentication.',
    };
  }
}

/**
 * Map raw Jellyfin API response object to standardized JellyfinItem
 */
export function mapJellyfinItem(raw: any, cleanUrl: string): JellyfinItem {
  const isFolder = Boolean(
    raw.IsFolder ||
    raw.Type === 'Folder' ||
    raw.Type === 'CollectionFolder' ||
    raw.Type === 'UserView' ||
    raw.Type === 'Series' ||
    raw.Type === 'Season' ||
    raw.Type === 'BoxSet'
  );

  const durationSeconds = raw.RunTimeTicks ? Math.floor(raw.RunTimeTicks / 10000000) : undefined;
  const primaryImg = raw.ImageTags?.Primary
    ? `${cleanUrl}/Items/${raw.Id}/Images/Primary?fillWidth=500&quality=90`
    : undefined;
  const backdropImg = raw.BackdropImageTags && raw.BackdropImageTags.length > 0
    ? `${cleanUrl}/Items/${raw.Id}/Images/Backdrop?fillWidth=1280&quality=85`
    : undefined;
  const bannerImg = raw.ImageTags?.Banner
    ? `${cleanUrl}/Items/${raw.Id}/Images/Banner?quality=90`
    : backdropImg;
  const imdbId = raw.ProviderIds?.Imdb || raw.ProviderIds?.imdb;
  const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined;

  const childCount =
    raw.ChildCount ??
    raw.RecursiveItemCount ??
    raw.ItemCounts?.TotalRecordCount ??
    raw.ItemCounts?.SeriesCount ??
    raw.ItemCounts?.EpisodeCount ??
    raw.ItemCounts?.MovieCount;

  const mediaStreams: MediaStreamInfo[] = (raw.MediaStreams || []).map((s: any) => ({
    index: s.Index,
    type: s.Type,
    codec: s.Codec,
    language: s.Language,
    displayTitle: s.DisplayTitle || `${s.Language || 'Unknown'} (${s.Codec || s.Type})`,
    isDefault: s.IsDefault,
    isForced: s.IsForced,
    isExternal: s.IsExternal,
    height: s.Height,
    width: s.Width,
    bitRate: s.BitRate,
  }));

  const chapters = (raw.Chapters || []).map((c: any, index: number) => {
    const startSec = c.StartPositionTicks ? Math.floor(c.StartPositionTicks / 10000000) : 0;
    const chImg = c.ImageTag
      ? `${cleanUrl}/Items/${raw.Id}/Images/Chapter/${index}?tag=${c.ImageTag}`
      : undefined;
    return {
      id: `ch-${index}`,
      name: c.Name || `Chapter ${index + 1}`,
      startPositionTicks: c.StartPositionTicks,
      startPositionSeconds: startSec,
      imageTag: c.ImageTag,
      imageUrl: chImg,
    };
  });

  let introStartPositionTicks = raw.IntroStartPositionTicks;
  let introEndPositionTicks = raw.IntroEndPositionTicks;

  if (raw.MediaSegments && Array.isArray(raw.MediaSegments)) {
    const introSeg = raw.MediaSegments.find((s: any) => s.Type === 'Intro' || s.SegmentType === 'Intro');
    if (introSeg) {
      introStartPositionTicks = introSeg.StartPositionTicks ?? introStartPositionTicks;
      introEndPositionTicks = introSeg.EndPositionTicks ?? introEndPositionTicks;
    }
  }

  const item: JellyfinItem = {
    id: raw.Id,
    name: raw.Name,
    originalTitle: raw.OriginalTitle,
    overview: raw.Overview,
    type: raw.Type || (isFolder ? 'Folder' : 'Video'),
    isFolder,
    collectionType: raw.CollectionType,
    childCount,
    itemCounts: raw.ItemCounts
      ? {
          movieCount: raw.ItemCounts.MovieCount,
          seriesCount: raw.ItemCounts.SeriesCount,
          episodeCount: raw.ItemCounts.EpisodeCount,
          folderCount: raw.ItemCounts.FolderCount,
        }
      : undefined,
    parentId: raw.ParentId,
    runTimeTicks: raw.RunTimeTicks,
    durationSeconds,
    productionYear: raw.ProductionYear,
    communityRating: raw.CommunityRating,
    genres: raw.Genres,
    primaryImageUrl: primaryImg,
    backdropImageUrl: backdropImg,
    bannerImageUrl: bannerImg,
    imdbId,
    imdbUrl,
    mediaStreams,
    chapters: chapters.length > 0 ? chapters : undefined,
    introStartPositionTicks,
    introEndPositionTicks,
    mediaSources: raw.MediaSources?.map((ms: any) => ({
      id: ms.Id,
      container: ms.Container,
      size: ms.Size,
      bitrate: ms.Bitrate,
    })),
    userData: {
      playbackPositionTicks: raw.UserData?.PlaybackPositionTicks,
      playedPercentage: raw.UserData?.PlayedPercentage,
      isFavorite: raw.UserData?.IsFavorite,
      played: raw.UserData?.Played,
    },
    dateCreated: raw.DateCreated || raw.DateAdded,
    seriesName: raw.SeriesName,
    seriesId: raw.SeriesId,
    seasonName: raw.SeasonName,
    seasonId: raw.SeasonId,
    indexNumber: raw.IndexNumber,
    parentIndexNumber: raw.ParentIndexNumber,
  };

  return enrichItemWithImdbBanner(item);
}

/**
 * Fetch top-level User Views (Root libraries & folders) from Jellyfin
 */
export async function fetchJellyfinUserViews(
  config: JellyfinServerConfig
): Promise<JellyfinItem[]> {
  if (config.isDemoMode) {
    return DEMO_USER_VIEWS;
  }

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Emby-Authorization': getAuthHeader(config.accessToken),
  };
  if (config.accessToken) {
    headers['X-Emby-Token'] = config.accessToken;
  }

  try {
    const res = await fetch(`${cleanUrl}/Users/${config.userId}/Views`, { headers });
    if (!res.ok) {
      // Fallback to /UserViews if /Users/{id}/Views is not permitted
      const fallbackRes = await fetch(`${cleanUrl}/UserViews`, { headers });
      if (!fallbackRes.ok) {
        throw new Error(`Failed to load server libraries (${res.status})`);
      }
      const fallbackData = await fallbackRes.json();
      return (fallbackData.Items || []).map((raw: any) => ({
        ...mapJellyfinItem(raw, cleanUrl),
        isFolder: true,
      }));
    }

    const data = await res.json();
    return (data.Items || []).map((raw: any) => ({
      ...mapJellyfinItem(raw, cleanUrl),
      isFolder: true,
    }));
  } catch (err: any) {
    // If views endpoint fails, fallback to root items
    return fetchJellyfinItems(config);
  }
}

/**
 * Fetch folder contents (children: folders and media items) matching Jellyfin server directory browsing
 */
export async function fetchJellyfinFolderContents(
  config: JellyfinServerConfig,
  parentId?: string,
  searchTerm?: string
): Promise<JellyfinItem[]> {
  if (config.isDemoMode) {
    return getDemoFolderContents(parentId, searchTerm);
  }

  // If no parentId is specified, fetch the top-level User Views (Libraries)
  if (!parentId) {
    return fetchJellyfinUserViews(config);
  }

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const params = new URLSearchParams({
    ParentId: parentId,
    Fields:
      'Overview,RunTimeTicks,MediaStreams,MediaSources,UserData,Genres,CommunityRating,ProductionYear,Chapters,ItemCounts,ChildCount,ImageTags,SeriesName,SeriesId,SeasonName,SeasonId,IndexNumber,ParentIndexNumber,CollectionType',
    SortBy: 'IsFolder,SortName',
    SortOrder: 'Ascending',
  });

  if (searchTerm && searchTerm.trim()) {
    params.set('SearchTerm', searchTerm.trim());
    params.set('Recursive', 'true');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Emby-Authorization': getAuthHeader(config.accessToken),
  };
  if (config.accessToken) {
    headers['X-Emby-Token'] = config.accessToken;
  }

  const res = await fetch(`${cleanUrl}/Users/${config.userId}/Items?${params.toString()}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to load folder items (${res.status})`);
  }

  const data = await res.json();
  const items = data.Items || [];
  return items.map((raw: any) => mapJellyfinItem(raw, cleanUrl));
}

/**
 * Fetch media items from Jellyfin (Flat recursive listing)
 */
export async function fetchJellyfinItems(
  config: JellyfinServerConfig,
  parentId?: string,
  searchTerm?: string
): Promise<JellyfinItem[]> {
  if (config.isDemoMode) {
    return filterDemoItems(searchTerm);
  }

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const params = new URLSearchParams({
    Recursive: 'true',
    IncludeItemTypes: 'Movie,Episode,Video',
    Fields:
      'Overview,RunTimeTicks,MediaStreams,MediaSources,UserData,Genres,CommunityRating,ProductionYear,Chapters,SeriesName,SeriesId,SeasonName,SeasonId,IndexNumber,ParentIndexNumber,DateCreated',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
  });

  if (parentId) {
    params.set('ParentId', parentId);
  }
  if (searchTerm && searchTerm.trim()) {
    params.set('SearchTerm', searchTerm.trim());
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Emby-Authorization': getAuthHeader(config.accessToken),
  };
  if (config.accessToken) {
    headers['X-Emby-Token'] = config.accessToken;
  }

  const res = await fetch(`${cleanUrl}/Users/${config.userId}/Items?${params.toString()}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to load items (${res.status})`);
  }

  const data = await res.json();
  const items = data.Items || [];

  return items.map((raw: any): JellyfinItem => ({
    ...mapJellyfinItem(raw, cleanUrl),
    isFolder: false,
  }));
}

/**
 * Get direct or adaptive transcoded stream URL for a Jellyfin video item
 */
export function getMediaStreamUrl(
  config: JellyfinServerConfig,
  item: JellyfinItem,
  mediaSourceId?: string,
  resolutionTier: VideoResolutionTier = 'original'
): string {
  if (config.isDemoMode) {
    const demo = DEMO_MEDIA_LIBRARY.find(d => d.id === item.id);
    const baseStreamUrl = demo?.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    
    // In demo mode, append resolution parameter to simulate differentiated stream URLs if not original
    if (resolutionTier && resolutionTier !== 'original' && resolutionTier !== 'auto') {
      try {
        const url = new URL(baseStreamUrl);
        url.searchParams.set('quality', resolutionTier);
        return url.toString();
      } catch {
        return baseStreamUrl;
      }
    }
    return baseStreamUrl;
  }

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const sourceId = mediaSourceId || item.mediaSources?.[0]?.id || item.id;
  const token = config.accessToken;

  // Direct play without transcoding for 'original'
  if (resolutionTier === 'original') {
    const url = new URL(`${cleanUrl}/Videos/${item.id}/stream.mp4`);
    url.searchParams.set('static', 'true');
    url.searchParams.set('mediaSourceId', sourceId);
    if (token) {
      url.searchParams.set('api_key', token);
    }
    return url.toString();
  }

  // Adaptive transcoded resolution stream for Jellyfin
  const preset = RESOLUTION_PRESETS[resolutionTier] || RESOLUTION_PRESETS['1080p'];
  const url = new URL(`${cleanUrl}/Videos/${item.id}/stream.mp4`);
  url.searchParams.set('static', 'false');
  url.searchParams.set('mediaSourceId', sourceId);
  if (preset.videoBitRate) {
    url.searchParams.set('videoBitRate', preset.videoBitRate.toString());
  }
  if (preset.maxHeight) {
    url.searchParams.set('maxHeight', preset.maxHeight.toString());
  }
  if (preset.maxWidth) {
    url.searchParams.set('maxWidth', preset.maxWidth.toString());
  }
  url.searchParams.set('videoCodec', 'h264');
  url.searchParams.set('audioCodec', 'aac');
  url.searchParams.set('audioBitRate', '128000');
  if (token) {
    url.searchParams.set('api_key', token);
  }
  return url.toString();
}

/**
 * Get subtitle stream URL from Jellyfin
 */
export function getSubtitleStreamUrl(
  config: JellyfinServerConfig,
  itemId: string,
  mediaSourceId: string,
  subtitleIndex: number,
  format: 'vtt' | 'srt' = 'vtt'
): string {
  const cleanUrl = cleanServerUrl(config.serverUrl);
  const token = config.accessToken;
  const url = new URL(`${cleanUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleIndex}/Stream.${format}`);
  if (token) {
    url.searchParams.set('api_key', token);
  }
  return url.toString();
}

/**
 * Reports playback start to Jellyfin to initiate active session tracking
 */
export async function reportPlaybackStart(
  config: JellyfinServerConfig,
  itemId: string,
  positionSeconds: number = 0
): Promise<void> {
  if (config.isDemoMode || !config.accessToken || !config.serverUrl) return;

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const positionTicks = Math.floor(positionSeconds * 10000000);

  try {
    await fetch(`${cleanUrl}/Sessions/Playing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader(config.accessToken),
        'X-Emby-Token': config.accessToken,
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
        PlayMethod: 'DirectStream',
        CanSeek: true,
      }),
    });
  } catch {
    // Ignore reporting errors silently
  }
}

/**
 * Reports playback position to Jellyfin to track watch progress and cross-device sync
 */
export async function reportPlaybackProgress(
  config: JellyfinServerConfig,
  itemId: string,
  positionSeconds: number,
  isPaused: boolean
): Promise<void> {
  if (config.isDemoMode || !config.accessToken || !config.serverUrl) return;

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const positionTicks = Math.floor(positionSeconds * 10000000);

  try {
    await fetch(`${cleanUrl}/Sessions/Playing/Progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader(config.accessToken),
        'X-Emby-Token': config.accessToken,
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
        IsPaused: isPaused,
        PlayMethod: 'DirectStream',
        CanSeek: true,
      }),
    });
  } catch {
    // Ignore progress reporting errors silently
  }
}

/**
 * Reports playback stopped to Jellyfin to finalize progress and clear active session
 */
export async function reportPlaybackStopped(
  config: JellyfinServerConfig,
  itemId: string,
  positionSeconds: number
): Promise<void> {
  if (config.isDemoMode || !config.accessToken || !config.serverUrl) return;

  const cleanUrl = cleanServerUrl(config.serverUrl);
  const positionTicks = Math.floor(positionSeconds * 10000000);

  try {
    await fetch(`${cleanUrl}/Sessions/Playing/Stopped`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': getAuthHeader(config.accessToken),
        'X-Emby-Token': config.accessToken,
      },
      body: JSON.stringify({
        ItemId: itemId,
        PositionTicks: positionTicks,
      }),
    });
  } catch {
    // Ignore reporting errors silently
  }
}

// ---------------- Demo Open-Source Sample Library ----------------

export interface DemoItem extends JellyfinItem {
  streamUrl: string;
  subtitlesList: Array<{
    id: string;
    label: string;
    language: string;
    rawText: string;
    format: 'srt' | 'vtt';
  }>;
}

const SAMPLE_ENGLISH_SRT = `1
00:00:01,000 --> 00:00:04,500
[Calm nature sounds and birds chirping in the open forest]

2
00:00:05,000 --> 00:00:08,200
A peaceful sunny morning in the woodland glade.

3
00:00:09,000 --> 00:00:13,400
The gentle rabbit emerges from his hollow burrow to greet the day.

4
00:00:14,000 --> 00:00:18,500
He stretches under the warm morning sunlight and admires the blooming flowers.

5
00:00:19,200 --> 00:00:23,800
Three playful forest creatures watch from the branches above.

6
00:00:25,000 --> 00:00:30,000
Offline caching active • Subtitle synchronization at +0.0s.
`;

const SAMPLE_SPANISH_SRT = `1
00:00:01,000 --> 00:00:04,500
[Sonidos apacibles del bosque y trinar de pájaros]

2
00:00:05,000 --> 00:00:08,200
Una hermosa mañana soleada en el claro del bosque.

3
00:00:09,000 --> 00:00:13,400
El conejito tranquilo sale de su madriguera para dar la bienvenida al día.

4
00:00:14,000 --> 00:00:18,500
Se estira bajo la cálida luz del sol y contempla las flores silvestres.

5
00:00:19,200 --> 00:00:23,800
Tres traviesas criaturas del bosque observan atentamente desde las ramas.

6
00:00:25,000 --> 00:00:30,000
Almacenamiento sin conexión activo • Sincronización de subtítulos.
`;

const SAMPLE_FRENCH_SRT = `1
00:00:01,000 --> 00:00:04,500
[Sons paisibles de la nature et chants d'oiseaux dans la forêt]

2
00:00:05,000 --> 00:00:08,200
Un matin doux et ensoleillé dans la clairière des bois.

3
00:00:09,000 --> 00:00:13,400
Le grand lapin calme sort doucement de son terrier pour saluer l'aube.

4
00:00:14,000 --> 00:00:18,500
Il s'étire sous les rayons chauds et contemple les fleurs sauvages.

5
00:00:19,200 --> 00:00:23,800
Trois créatures espiègles l'observent depuis les branches d'arbres.

6
00:00:25,000 --> 00:00:30,000
Mise en cache hors ligne disponible • Sous-titres personnalisés.
`;

export const DEMO_MEDIA_LIBRARY: DemoItem[] = [
  {
    id: 'demo-big-buck-bunny',
    name: 'Big Buck Bunny',
    originalTitle: 'Peach Open Movie Project',
    overview: 'A large and lovable rabbit deals with bullying forest creatures in this classic Blender Foundation open film.',
    type: 'Episode',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 1,
    durationSeconds: 596, // ~9 min 56s
    productionYear: 2008,
    dateCreated: '2024-01-10T10:00:00Z',
    communityRating: 7.0,
    imdbRating: 7.0,
    imdbId: 'tt1254207',
    imdbUrl: 'https://www.imdb.com/title/tt1254207/',
    genres: ['Animation', 'Comedy', 'Open Cinema'],
    primaryImageUrl: 'https://m.media-amazon.com/images/M/MV5BNDA3OGZkMTMtYmUxZi00N2U0LTljZWItZmU3N2U3ZTIzYjJmXkEyXkFqcGc@._V1_.jpg',
    backdropImageUrl: 'https://m.media-amazon.com/images/M/MV5BNDA3OGZkMTMtYmUxZi00N2U0LTljZWItZmU3N2U3ZTIzYjJmXkEyXkFqcGc@._V1_CR0,200,1500,844_QL75_UX1600_.jpg',
    bannerImageUrl: 'https://m.media-amazon.com/images/M/MV5BNDA3OGZkMTMtYmUxZi00N2U0LTljZWItZmU3N2U3ZTIzYjJmXkEyXkFqcGc@._V1_CR0,200,1500,844_QL75_UX1600_.jpg',
    streamUrl: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p H.264 High Profile', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'eng', displayTitle: 'English (AAC Stereo)' },
      { index: 2, type: 'Subtitle', codec: 'subrip', language: 'eng', displayTitle: 'English [CC]', isDefault: true },
      { index: 3, type: 'Subtitle', codec: 'subrip', language: 'spa', displayTitle: 'Español' },
      { index: 4, type: 'Subtitle', codec: 'subrip', language: 'fra', displayTitle: 'Français' },
    ],
    subtitlesList: [
      { id: 'sub-en', label: 'English [CC]', language: 'eng', rawText: SAMPLE_ENGLISH_SRT, format: 'srt' },
      { id: 'sub-es', label: 'Español', language: 'spa', rawText: SAMPLE_SPANISH_SRT, format: 'srt' },
      { id: 'sub-fr', label: 'Français', language: 'fra', rawText: SAMPLE_FRENCH_SRT, format: 'srt' },
    ],
    chapters: [
      { id: 'bbb-ch-0', name: 'Prologue: Forest Awakening', startPositionSeconds: 0 },
      { id: 'bbb-ch-1', name: 'Opening Credits', startPositionSeconds: 12 },
      { id: 'bbb-ch-2', name: 'The Woodland Pests', startPositionSeconds: 85 },
      { id: 'bbb-ch-3', name: 'Butterfly Pranks & Target Practice', startPositionSeconds: 190 },
      { id: 'bbb-ch-4', name: 'Big Buck Prepares Retaliation', startPositionSeconds: 340 },
      { id: 'bbb-ch-5', name: 'The Trap is Sprung', startPositionSeconds: 450 },
      { id: 'bbb-ch-6', name: 'Victory & Epilogue', startPositionSeconds: 540 },
    ],
    introSegment: {
      startSeconds: 12,
      endSeconds: 85,
      source: 'metadata',
      label: 'Opening Credits',
    },
    userData: {
      playbackPositionTicks: 0,
      playedPercentage: 0,
      isFavorite: true,
      played: false,
    },
  },
  {
    id: 'demo-sintel',
    name: 'Sintel',
    originalTitle: 'Durian Open Movie Project',
    overview: 'A lonely young woman named Sintel embarks on a dangerous quest across harsh lands to find her kidnapped dragon baby companion Scales.',
    type: 'Episode',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 2,
    durationSeconds: 888,
    productionYear: 2010,
    dateCreated: '2024-02-15T12:00:00Z',
    communityRating: 7.4,
    imdbRating: 7.4,
    imdbId: 'tt1727587',
    imdbUrl: 'https://www.imdb.com/title/tt1727587/',
    genres: ['Fantasy', 'Adventure', 'Animation'],
    primaryImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzc5NTUzNTgzMF5BMl5BanBnXkFtZTcwODcwMzQ5Mw@@._V1_.jpg',
    backdropImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzc5NTUzNTgzMF5BMl5BanBnXkFtZTcwODcwMzQ5Mw@@._V1_CR0,160,905,509_QL75_UX1600_.jpg',
    bannerImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzc5NTUzNTgzMF5BMl5BanBnXkFtZTcwODcwMzQ5Mw@@._V1_CR0,160,905,509_QL75_UX1600_.jpg',
    streamUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p H.264', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'eng', displayTitle: 'English (Surround)' },
      { index: 2, type: 'Subtitle', codec: 'subrip', language: 'eng', displayTitle: 'English [CC]', isDefault: true },
    ],
    subtitlesList: [
      {
        id: 'sub-sintel-en',
        label: 'English [CC]',
        language: 'eng',
        rawText: `1\n00:00:03,000 --> 00:00:06,500\n[Wind howling across icy peaks]\n\n2\n00:00:07,000 --> 00:00:11,000\nAre you looking for someone?\n\n3\n00:00:12,000 --> 00:00:16,000\nI am looking for Scales.`,
        format: 'srt',
      },
    ],
    chapters: [
      { id: 'sintel-ch-0', name: 'Frozen Mountain Pass', startPositionSeconds: 0 },
      { id: 'sintel-ch-intro', name: 'Opening Sequence', startPositionSeconds: 15 },
      { id: 'sintel-ch-1', name: 'Finding the Wounded Dragon', startPositionSeconds: 200 },
      { id: 'sintel-ch-2', name: 'Friendship & Combat Training', startPositionSeconds: 405 },
      { id: 'sintel-ch-3', name: 'The Dragon Colosseum', startPositionSeconds: 630 },
      { id: 'sintel-ch-4', name: 'The Final Awakening', startPositionSeconds: 790 },
    ],
    introSegment: {
      startSeconds: 15,
      endSeconds: 95,
      source: 'metadata',
      label: 'Opening Sequence',
    },
    userData: {
      playbackPositionTicks: 0,
      playedPercentage: 0,
      isFavorite: true,
      played: false,
    },
  },
  {
    id: 'demo-tears-of-steel',
    name: 'Tears of Steel',
    originalTitle: 'Mango Open Movie Project',
    overview: 'Set in a dystopian future in Amsterdam, a group of warriors and scientists try to save the world from destructive robots.',
    type: 'Episode',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 3,
    durationSeconds: 734,
    productionYear: 2012,
    dateCreated: '2024-03-20T14:00:00Z',
    communityRating: 6.4,
    imdbRating: 6.4,
    imdbId: 'tt2285752',
    imdbUrl: 'https://www.imdb.com/title/tt2285752/',
    genres: ['Sci-Fi', 'Action', 'VFX Showcase'],
    primaryImageUrl: 'https://m.media-amazon.com/images/M/MV5BMTczMzQzNDE5NV5BMl5BanBnXkFtZTcwNzYwMzQ1OA@@._V1_.jpg',
    backdropImageUrl: 'https://m.media-amazon.com/images/M/MV5BMTczMzQzNDE5NV5BMl5BanBnXkFtZTcwNzYwMzQ1OA@@._V1_CR0,200,1200,675_QL75_UX1600_.jpg',
    bannerImageUrl: 'https://m.media-amazon.com/images/M/MV5BMTczMzQzNDE5NV5BMl5BanBnXkFtZTcwNzYwMzQ1OA@@._V1_CR0,200,1200,675_QL75_UX1600_.jpg',
    streamUrl: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p H.264 (24fps)', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'eng', displayTitle: 'English (Stereo)' },
      { index: 2, type: 'Subtitle', codec: 'subrip', language: 'eng', displayTitle: 'English [CC]', isDefault: true },
    ],
    subtitlesList: [
      {
        id: 'sub-tos-en',
        label: 'English [CC]',
        language: 'eng',
        rawText: `1\n00:00:02,000 --> 00:00:05,000\n[Atmospheric synthesizer hum]\n\n2\n00:00:06,000 --> 00:00:10,000\nAmsterdam, Old Church Tower base station.\n\n3\n00:00:11,500 --> 00:00:16,000\nCalibration sequence initiated. Robot defense grid online.`,
        format: 'srt',
      },
    ],
    chapters: [
      { id: 'tos-ch-0', name: 'Amsterdam Outpost & Calibration', startPositionSeconds: 0 },
      { id: 'tos-ch-intro', name: 'Opening Credits', startPositionSeconds: 10 },
      { id: 'tos-ch-1', name: 'Tracking the Mech Units', startPositionSeconds: 135 },
      { id: 'tos-ch-2', name: 'Celia and the Memory Interface', startPositionSeconds: 270 },
      { id: 'tos-ch-3', name: 'Rocket Defense Launch', startPositionSeconds: 490 },
      { id: 'tos-ch-4', name: 'System Core Override & Epilogue', startPositionSeconds: 645 },
    ],
    introSegment: {
      startSeconds: 10,
      endSeconds: 78,
      source: 'metadata',
      label: 'Opening Credits',
    },
    userData: {
      playbackPositionTicks: 0,
      playedPercentage: 0,
      isFavorite: false,
      played: false,
    },
  },
  {
    id: 'demo-cosmos-laundromat',
    name: 'Cosmos Laundromat',
    originalTitle: 'Cosmos Laundromat: First Cycle',
    overview: 'On a desolate, dreary island, a suicidal sheep named Franck meets a mysterious salesman who offers him the gift of a lifetime, which turns out to be many lifetimes.',
    type: 'Movie',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 4,
    durationSeconds: 730,
    productionYear: 2015,
    dateCreated: '2024-04-10T11:00:00Z',
    communityRating: 7.2,
    imdbRating: 7.2,
    imdbId: 'tt4957236',
    imdbUrl: 'https://www.imdb.com/title/tt4957236/',
    genres: ['Animation', 'Comedy', 'Sci-Fi', 'Fantasy'],
    primaryImageUrl: 'https://m.media-amazon.com/images/M/MV5BODUwMjE4OTQ2Nl5BMl5BanBnXkFtZTgwMDE3NjQ2NjE@._V1_.jpg',
    backdropImageUrl: 'https://m.media-amazon.com/images/M/MV5BODUwMjE4OTQ2Nl5BMl5BanBnXkFtZTgwMDE3NjQ2NjE@._V1_CR0,280,1589,894_QL75_UX1600_.jpg',
    bannerImageUrl: 'https://m.media-amazon.com/images/M/MV5BODUwMjE4OTQ2Nl5BMl5BanBnXkFtZTgwMDE3NjQ2NjE@._V1_CR0,280,1589,894_QL75_UX1600_.jpg',
    streamUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p H.264 High Profile', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'eng', displayTitle: 'English (5.1)' },
      { index: 2, type: 'Subtitle', codec: 'subrip', language: 'eng', displayTitle: 'English [CC]', isDefault: true },
    ],
    subtitlesList: [
      {
        id: 'sub-cosmos-en',
        label: 'English [CC]',
        language: 'eng',
        rawText: `1\n00:00:02,000 --> 00:00:06,000\n[Bleak wind sweeping across the lonely island]\n\n2\n00:00:07,000 --> 00:00:11,000\nFranck, are you ready for a fresh start?`,
        format: 'srt',
      },
    ],
    userData: {
      playbackPositionTicks: 0,
      playedPercentage: 0,
      isFavorite: true,
      played: false,
    },
  },
  {
    id: 'demo-elephants-dream',
    name: 'Elephants Dream',
    originalTitle: 'Orange Open Movie Project',
    overview: 'Friends Proog and Emo journey through the surreal and mechanical labyrinth of a giant machine that manifests thoughts and delusions.',
    type: 'Movie',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 5,
    durationSeconds: 654,
    productionYear: 2006,
    dateCreated: '2024-05-01T12:00:00Z',
    communityRating: 6.8,
    imdbRating: 6.8,
    imdbId: 'tt0807840',
    imdbUrl: 'https://www.imdb.com/title/tt0807840/',
    genres: ['Animation', 'Sci-Fi', 'Fantasy'],
    primaryImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzI3NTFlOGUtOWE2MS00NDliLWJmODgtYTY3NDA5MmIzMjg5XkEyXkFqcGc@._V1_.jpg',
    backdropImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzI3NTFlOGUtOWE2MS00NDliLWJmODgtYTY3NDA5MmIzMjg5XkEyXkFqcGc@._V1_CR0,350,2048,1152_QL75_UX1600_.jpg',
    bannerImageUrl: 'https://m.media-amazon.com/images/M/MV5BMzI3NTFlOGUtOWE2MS00NDliLWJmODgtYTY3NDA5MmIzMjg5XkEyXkFqcGc@._V1_CR0,350,2048,1152_QL75_UX1600_.jpg',
    streamUrl: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p H.264', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'eng', displayTitle: 'English (Stereo)' },
      { index: 2, type: 'Subtitle', codec: 'subrip', language: 'eng', displayTitle: 'English [CC]', isDefault: true },
    ],
    subtitlesList: [
      {
        id: 'sub-elephants-en',
        label: 'English [CC]',
        language: 'eng',
        rawText: `1\n00:00:02,000 --> 00:00:05,000\n[Mechanical churning of gears and pipes]\n\n2\n00:00:06,000 --> 00:00:10,000\nKeep close to me, Emo. The machine is listening.`,
        format: 'srt',
      },
    ],
    userData: {
      playbackPositionTicks: 0,
      playedPercentage: 0,
      isFavorite: false,
      played: false,
    },
  },
  {
    id: 'demo-for-bigger-blazes',
    name: 'Chromecast Nature Journey',
    originalTitle: 'For Bigger Blazes',
    overview: 'A breathtaking high-definition visual reel celebrating natural landscapes, rivers, and outdoor vistas.',
    type: 'Episode',
    seriesName: 'Open Cinema Chronicles',
    seriesId: 'series-open-cinema',
    seasonName: 'Season 1',
    parentIndexNumber: 1,
    indexNumber: 6,
    durationSeconds: 15,
    productionYear: 2021,
    dateCreated: '2024-04-25T16:00:00Z',
    communityRating: 8.9,
    genres: ['Documentary', 'Nature', 'Short Film'],
    primaryImageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
    backdropImageUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600&auto=format&fit=crop&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600&auto=format&fit=crop&q=80',
    imdbUrl: 'https://www.imdb.com/',
    streamUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    mediaStreams: [
      { index: 0, type: 'Video', codec: 'h264', displayTitle: '1080p Full HD', height: 1080, width: 1920 },
      { index: 1, type: 'Audio', codec: 'aac', language: 'und', displayTitle: 'Original Audio' },
    ],
    subtitlesList: [
      {
        id: 'sub-blazes-en',
        label: 'English [CC]',
        language: 'eng',
        rawText: `1\n00:00:01,000 --> 00:00:05,000\n[Dynamic cinematic orchestral score]\n\n2\n00:00:06,000 --> 00:00:10,000\nImmerse yourself in vibrant natural scenery.`,
        format: 'srt',
      },
    ],
  },
];

export const DEMO_USER_VIEWS: JellyfinItem[] = [
  {
    id: 'demo-view-movies',
    name: 'Movies',
    type: 'CollectionFolder',
    collectionType: 'movies',
    isFolder: true,
    childCount: 5,
    overview: 'Full-length animated and live-action open films from Blender Animation Studio.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    backdropImageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600&auto=format&fit=crop&q=80',
  },
  {
    id: 'demo-view-tvshows',
    name: 'TV Shows',
    type: 'CollectionFolder',
    collectionType: 'tvshows',
    isFolder: true,
    childCount: 1,
    overview: 'Serialized TV programs, anthology series, and seasonal releases.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&auto=format&fit=crop&q=80',
    backdropImageUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=1600&auto=format&fit=crop&q=80',
  },
  {
    id: 'demo-view-nature',
    name: 'Documentaries & Nature',
    type: 'CollectionFolder',
    collectionType: 'homevideos',
    isFolder: true,
    childCount: 2,
    overview: 'High dynamic range drone footage, scenic reels, and natural vistas.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
    backdropImageUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1600&auto=format&fit=crop&q=80',
  },
];

export const DEMO_SERIES_ITEM: JellyfinItem = {
  id: 'series-open-cinema',
  name: 'Open Cinema Chronicles',
  originalTitle: 'The Blender Open Film Anthology',
  overview: 'A serialized retrospective celebrating groundbreaking community-driven CGI animation and digital visual effects.',
  type: 'Series',
  isFolder: true,
  childCount: 1,
  productionYear: 2022,
  communityRating: 8.8,
  genres: ['Animation', 'Sci-Fi', 'Anthology'],
  primaryImageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
  backdropImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
  seriesId: 'series-open-cinema',
  seriesName: 'Open Cinema Chronicles',
};

export const DEMO_SEASON_ITEM: JellyfinItem = {
  id: 'season-1-open-cinema',
  name: 'Season 1',
  type: 'Season',
  isFolder: true,
  childCount: 4,
  parentIndexNumber: 1,
  seriesName: 'Open Cinema Chronicles',
  seriesId: 'series-open-cinema',
  overview: 'Season 1 features all four premiere anthology short films and demonstrations.',
  primaryImageUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
  backdropImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
};

export const DEMO_NATURE_FOLDER: JellyfinItem = {
  id: 'folder-scenic-reels',
  name: 'Scenic Landscape Reels',
  type: 'Folder',
  isFolder: true,
  childCount: 1,
  overview: 'Ultra HD drone and camera footage of natural parks and rivers.',
  primaryImageUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=600&auto=format&fit=crop&q=80',
  backdropImageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&auto=format&fit=crop&q=80',
};

export function getDemoFolderContents(parentId?: string, searchTerm?: string): JellyfinItem[] {
  if (searchTerm && searchTerm.trim()) {
    return filterDemoItems(searchTerm);
  }

  // Root view: Return the top-level User Libraries / Views
  if (!parentId) {
    return DEMO_USER_VIEWS;
  }

  // Under "Movies" library:
  if (parentId === 'demo-view-movies') {
    return DEMO_MEDIA_LIBRARY.slice(0, 3).map((item) => ({
      ...item,
      type: 'Movie',
      isFolder: false,
    }));
  }

  // Under "TV Shows" library:
  if (parentId === 'demo-view-tvshows') {
    return [DEMO_SERIES_ITEM];
  }

  // Under Series:
  if (parentId === 'series-open-cinema') {
    return [DEMO_SEASON_ITEM];
  }

  // Under Season 1:
  if (parentId === 'season-1-open-cinema') {
    return DEMO_MEDIA_LIBRARY.map((item) => ({
      ...item,
      type: 'Episode',
      isFolder: false,
    }));
  }

  // Under "Documentaries & Nature" library:
  if (parentId === 'demo-view-nature') {
    const blazeItem = DEMO_MEDIA_LIBRARY.find((i) => i.id === 'demo-for-bigger-blazes');
    return [
      DEMO_NATURE_FOLDER,
      blazeItem ? { ...blazeItem, type: 'Video', isFolder: false } : DEMO_MEDIA_LIBRARY[0],
    ];
  }

  // Under Nature Subfolder:
  if (parentId === 'folder-scenic-reels') {
    const blazeItem = DEMO_MEDIA_LIBRARY.find((i) => i.id === 'demo-for-bigger-blazes');
    return blazeItem ? [{ ...blazeItem, type: 'Video', isFolder: false }] : [];
  }

  return DEMO_USER_VIEWS;
}

function filterDemoItems(searchTerm?: string): JellyfinItem[] {
  if (!searchTerm || !searchTerm.trim()) {
    return DEMO_MEDIA_LIBRARY;
  }
  const term = searchTerm.toLowerCase().trim();
  return DEMO_MEDIA_LIBRARY.filter(
    item =>
      item.name.toLowerCase().includes(term) ||
      item.overview?.toLowerCase().includes(term) ||
      item.genres?.some(g => g.toLowerCase().includes(term))
  );
}
