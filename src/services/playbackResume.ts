/**
 * Service to manage video playback positions in localStorage for resume functionality.
 */

export interface PlaybackResumeEntry {
  itemId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
  title?: string;
  percentage: number;
}

const STORAGE_KEY = 'jellyfin_playback_resume_map';

export function getPlaybackResumeMap(): Record<string, PlaybackResumeEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse playback resume map from localStorage:', err);
    return {};
  }
}

export function getPlaybackResume(itemId: string): PlaybackResumeEntry | null {
  if (!itemId) return null;
  const map = getPlaybackResumeMap();
  return map[itemId] || null;
}

export function savePlaybackResume(
  itemId: string,
  positionSeconds: number,
  durationSeconds: number,
  title?: string
): void {
  if (!itemId || isNaN(positionSeconds)) return;

  try {
    const map = getPlaybackResumeMap();

    // If watched to near end (last 15 seconds or > 95%), clear resume position
    if (
      (durationSeconds > 30 && positionSeconds >= durationSeconds - 15) ||
      (durationSeconds > 0 && positionSeconds / durationSeconds >= 0.95)
    ) {
      if (map[itemId]) {
        delete map[itemId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent('jellyfin_resume_updated', { detail: { itemId, cleared: true } }));
      }
      return;
    }

    // Don't record tiny accidental starts under 5 seconds
    if (positionSeconds < 5) {
      if (map[itemId]) {
        delete map[itemId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent('jellyfin_resume_updated', { detail: { itemId, cleared: true } }));
      }
      return;
    }

    const percentage = durationSeconds > 0
      ? Math.min(100, Math.max(1, Math.round((positionSeconds / durationSeconds) * 100)))
      : 0;

    const entry: PlaybackResumeEntry = {
      itemId,
      positionSeconds: Math.round(positionSeconds),
      durationSeconds: Math.round(durationSeconds),
      updatedAt: Date.now(),
      title,
      percentage,
    };

    map[itemId] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('jellyfin_resume_updated', { detail: { itemId, entry } }));
  } catch (err) {
    console.warn('Failed to save playback resume position:', err);
  }
}

export function clearPlaybackResume(itemId: string): void {
  if (!itemId) return;
  try {
    const map = getPlaybackResumeMap();
    if (map[itemId]) {
      delete map[itemId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      window.dispatchEvent(new CustomEvent('jellyfin_resume_updated', { detail: { itemId, cleared: true } }));
    }
  } catch (err) {
    console.warn('Failed to clear playback resume position:', err);
  }
}

export function formatResumeTimestamp(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
}
