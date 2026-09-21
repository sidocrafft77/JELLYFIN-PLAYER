import { JellyfinItem, JellyfinServerConfig, VideoResolutionOption, VideoResolutionTier } from '../types';

export const RESOLUTION_PRESETS: Record<VideoResolutionTier, VideoResolutionOption> = {
  auto: {
    id: 'auto',
    label: 'Auto (Adaptive)',
    shortLabel: 'Auto',
    description: 'Automatically adapts resolution to network speed and buffer health',
    badge: 'Adaptive',
  },
  '1080p': {
    id: '1080p',
    label: '1080p Full HD',
    shortLabel: '1080p',
    maxHeight: 1080,
    maxWidth: 1920,
    videoBitRate: 8000000,
    description: '8.0 Mbps • Crisp high-definition for fast connections',
    badge: 'FHD',
  },
  '720p': {
    id: '720p',
    label: '720p HD',
    shortLabel: '720p',
    maxHeight: 720,
    maxWidth: 1280,
    videoBitRate: 4000000,
    description: '4.0 Mbps • Balanced quality and smooth streaming',
    badge: 'HD',
  },
  '480p': {
    id: '480p',
    label: '480p SD',
    shortLabel: '480p',
    maxHeight: 480,
    maxWidth: 854,
    videoBitRate: 1500000,
    description: '1.5 Mbps • Standard definition, low data usage',
    badge: 'SD',
  },
  '360p': {
    id: '360p',
    label: '360p Data Saver',
    shortLabel: '360p',
    maxHeight: 360,
    maxWidth: 640,
    videoBitRate: 700000,
    description: '700 Kbps • Fast loading on slow or cellular networks',
    badge: 'Data Saver',
  },
  original: {
    id: 'original',
    label: 'Original (Direct Play)',
    shortLabel: 'Original',
    description: 'Source quality without transcoding or compression',
    badge: 'Direct',
  },
};

const STORAGE_KEY = 'jellyfin_video_resolution_preference';

/**
 * Retrieves the saved resolution preference (defaults to 'auto')
 */
export function getSavedResolutionPreference(): VideoResolutionTier {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as VideoResolutionTier;
    if (saved && RESOLUTION_PRESETS[saved]) {
      return saved;
    }
  } catch (err) {
    console.warn('Failed to read resolution preference from storage', err);
  }
  return 'auto';
}

/**
 * Saves user resolution preference
 */
export function saveResolutionPreference(tier: VideoResolutionTier): void {
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch (err) {
    console.warn('Failed to save resolution preference to storage', err);
  }
}

export interface NetworkHealthInfo {
  downlinkMbps?: number;
  effectiveType?: string;
  rttMs?: number;
  saveData?: boolean;
}

/**
 * Reads browser Network Information API if available
 */
export function getNetworkInfo(): NetworkHealthInfo {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
  if (!connection) {
    return {};
  }
  return {
    downlinkMbps: connection.downlink,
    effectiveType: connection.effectiveType,
    rttMs: connection.rtt,
    saveData: connection.saveData,
  };
}

/**
 * Determines appropriate resolution tier based on network bandwidth
 */
export function determineResolutionFromBandwidth(network: NetworkHealthInfo): Exclude<VideoResolutionTier, 'auto'> {
  if (network.saveData) {
    return '360p';
  }

  const mbps = network.downlinkMbps;
  if (typeof mbps === 'number' && mbps > 0) {
    if (mbps >= 8) return '1080p';
    if (mbps >= 4) return '720p';
    if (mbps >= 1.5) return '480p';
    return '360p';
  }

  if (network.effectiveType) {
    if (network.effectiveType === '4g') return '1080p';
    if (network.effectiveType === '3g') return '480p';
    return '360p';
  }

  // Default fallback for unknown fast broadband
  return '1080p';
}

/**
 * Evaluates adaptive resolution adjustment taking into account buffer health and stall events
 */
export function computeAdaptiveResolution(params: {
  currentTier: Exclude<VideoResolutionTier, 'auto'>;
  bufferAheadSeconds: number;
  stallCountInWindow: number;
  network: NetworkHealthInfo;
}): {
  newTier: Exclude<VideoResolutionTier, 'auto'>;
  reason?: string;
} {
  const { currentTier, bufferAheadSeconds, stallCountInWindow, network } = params;
  const tiers: Array<Exclude<VideoResolutionTier, 'auto' | 'original'>> = ['360p', '480p', '720p', '1080p'];
  const currentIndex = tiers.indexOf(currentTier as any);

  // If frequent stalls occurred or buffer is empty (< 2s) while playing, step down
  if (stallCountInWindow >= 2 || bufferAheadSeconds < 1.8) {
    if (currentIndex > 0) {
      const lowerTier = tiers[currentIndex - 1];
      return {
        newTier: lowerTier,
        reason: `Buffer underrun (${bufferAheadSeconds.toFixed(1)}s ahead) - stepped down to ${lowerTier}`,
      };
    }
    return { newTier: '360p', reason: 'Buffer underrun - keeping minimal 360p' };
  }

  // If buffer is healthy (> 20s) and zero stalls, and network supports it, we can step up
  const networkRecommended = determineResolutionFromBandwidth(network);
  const targetIndex = tiers.indexOf(networkRecommended as any);

  if (bufferAheadSeconds >= 18 && stallCountInWindow === 0 && targetIndex > currentIndex && currentIndex !== -1) {
    const higherTier = tiers[currentIndex + 1];
    return {
      newTier: higherTier,
      reason: `Buffer healthy (${bufferAheadSeconds.toFixed(1)}s ahead) - upgraded to ${higherTier}`,
    };
  }

  return { newTier: currentTier };
}
