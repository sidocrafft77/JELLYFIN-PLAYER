import { JellyfinItem } from '../types';
import { getPlaybackResumeMap, formatResumeTimestamp } from './playbackResume';
import { DEMO_MEDIA_LIBRARY } from './jellyfinApi';

export interface WatchHistoryEntry {
  itemId: string;
  item: JellyfinItem;
  lastPositionSeconds: number;
  durationSeconds: number;
  percentage: number;
  lastWatchedAt: number; // timestamp in ms
  isCompleted?: boolean;
}

const STORAGE_KEY = 'jellyfin_watch_history_list';

/**
 * Retrieves the watch history array from localStorage.
 * If watch history is empty but resume points exist, backfills entries from DEMO_MEDIA_LIBRARY.
 */
export function getWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed: WatchHistoryEntry[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // Backfill from resume map if available so existing in-progress items are present
    const resumeMap = getPlaybackResumeMap();
    const resumeKeys = Object.keys(resumeMap);
    if (resumeKeys.length > 0) {
      const backfilled: WatchHistoryEntry[] = [];
      for (const key of resumeKeys) {
        const resume = resumeMap[key];
        const matchedItem = DEMO_MEDIA_LIBRARY.find((d) => d.id === key);
        if (matchedItem) {
          backfilled.push({
            itemId: key,
            item: matchedItem,
            lastPositionSeconds: resume.positionSeconds,
            durationSeconds: resume.durationSeconds || matchedItem.durationSeconds || 0,
            percentage: resume.percentage || 0,
            lastWatchedAt: resume.updatedAt || Date.now(),
            isCompleted: false,
          });
        }
      }

      if (backfilled.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backfilled));
        return backfilled;
      }
    }

    // Provide initial sample continue-watching items from the open demo library on clean start
    if (raw === null && DEMO_MEDIA_LIBRARY.length >= 3) {
      const defaultDemoEntries: WatchHistoryEntry[] = [
        {
          itemId: 'demo-sintel',
          item: DEMO_MEDIA_LIBRARY.find((d) => d.id === 'demo-sintel') || DEMO_MEDIA_LIBRARY[2],
          lastPositionSeconds: 576,
          durationSeconds: 888,
          percentage: 65,
          lastWatchedAt: Date.now() - 3600000 * 2,
          isCompleted: false,
        },
        {
          itemId: 'demo-bbb',
          item: DEMO_MEDIA_LIBRARY.find((d) => d.id === 'demo-bbb') || DEMO_MEDIA_LIBRARY[0],
          lastPositionSeconds: 250,
          durationSeconds: 596,
          percentage: 42,
          lastWatchedAt: Date.now() - 3600000 * 24,
          isCompleted: false,
        },
        {
          itemId: 'demo-tears-of-steel',
          item: DEMO_MEDIA_LIBRARY.find((d) => d.id === 'demo-tears-of-steel') || DEMO_MEDIA_LIBRARY[3],
          lastPositionSeconds: 587,
          durationSeconds: 734,
          percentage: 80,
          lastWatchedAt: Date.now() - 3600000 * 48,
          isCompleted: false,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDemoEntries));
      return defaultDemoEntries;
    }

    return [];
  } catch (err) {
    console.warn('Failed to parse watch history from localStorage:', err);
    return [];
  }
}

/**
 * Adds or updates a watch history entry.
 */
export function recordWatchHistory(
  item: JellyfinItem,
  positionSeconds: number,
  durationSeconds: number,
  isCompleted: boolean = false
): void {
  if (!item || !item.id) return;

  try {
    const history = getWatchHistory();
    const existingIndex = history.findIndex((h) => h.itemId === item.id);

    let pos = Math.max(0, Math.round(positionSeconds));
    const dur = Math.max(0, Math.round(durationSeconds || item.durationSeconds || 0));

    // If pos is 0 but item was previously watched with progress, preserve previous pos unless completed
    if (existingIndex >= 0 && pos === 0 && !isCompleted) {
      const prev = history[existingIndex];
      if (prev.lastPositionSeconds > 0) {
        pos = prev.lastPositionSeconds;
      }
    }

    const percentage =
      dur > 0 ? Math.min(100, Math.max(1, Math.round((pos / dur) * 100))) : 0;
    const completed =
      isCompleted || (dur > 20 && pos >= dur - 15) || percentage >= 95;

    const entry: WatchHistoryEntry = {
      itemId: item.id,
      item,
      lastPositionSeconds: pos,
      durationSeconds: dur,
      percentage,
      lastWatchedAt: Date.now(),
      isCompleted: completed,
    };

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    history.unshift(entry);

    // Keep up to 100 entries
    if (history.length > 100) {
      history.length = 100;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('jellyfin_history_updated'));
  } catch (err) {
    console.warn('Failed to save watch history:', err);
  }
}

/**
 * Removes an individual item from watch history.
 */
export function removeWatchHistoryItem(itemId: string): void {
  if (!itemId) return;
  try {
    const history = getWatchHistory().filter((h) => h.itemId !== itemId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('jellyfin_history_updated'));
  } catch (err) {
    console.warn('Failed to remove item from watch history:', err);
  }
}

/**
 * Clears the entire watch history list.
 */
export function clearWatchHistory(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem('jellyfin_playback_resume_map');
    window.dispatchEvent(new CustomEvent('jellyfin_history_updated'));
    window.dispatchEvent(new CustomEvent('jellyfin_resume_updated', { detail: { clearedAll: true } }));
  } catch (err) {
    console.warn('Failed to clear watch history:', err);
  }
}

/**
 * Calculates total seconds watched across all history entries.
 */
export function calculateTotalSecondsWatched(entries: WatchHistoryEntry[]): number {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((acc, entry) => {
    if (entry.isCompleted) {
      return acc + (entry.durationSeconds > 0 ? entry.durationSeconds : (entry.lastPositionSeconds || 0));
    }
    const watched = Math.max(0, entry.lastPositionSeconds || 0);
    return acc + (entry.durationSeconds > 0 ? Math.min(watched, entry.durationSeconds) : watched);
  }, 0);
}

/**
 * Calculates total minutes watched across all history entries.
 */
export function calculateTotalMinutesWatched(entries: WatchHistoryEntry[]): number {
  const totalSeconds = calculateTotalSecondsWatched(entries);
  return Math.round(totalSeconds / 60);
}

/**
 * Formats minutes into human-readable hours and minutes (e.g., "2h 22m" or "45m").
 */
export function formatMinutesHuman(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format relative time ago (e.g., "5m ago", "2h ago", "Yesterday").
 */
export function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp display with optional duration.
 */
export function formatHistoryTimestamp(
  positionSeconds: number,
  durationSeconds?: number
): string {
  const posFormatted = formatResumeTimestamp(positionSeconds);
  if (durationSeconds && durationSeconds > 0) {
    const durFormatted = formatResumeTimestamp(durationSeconds);
    return `${posFormatted} / ${durFormatted}`;
  }
  return posFormatted;
}
