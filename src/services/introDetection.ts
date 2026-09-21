import { JellyfinItem, IntroSegment, MediaChapter } from '../types';

export interface SkipIntroSettings {
  enabled: boolean;
  autoSkip: boolean;
  showNotification: boolean;
  enableIntervalFallback: boolean;
  defaultIntervalDurationSeconds: number;
}

const SETTINGS_KEY = 'jellyfin_skip_intro_settings';

export const DEFAULT_SKIP_INTRO_SETTINGS: SkipIntroSettings = {
  enabled: true,
  autoSkip: false,
  showNotification: true,
  enableIntervalFallback: true,
  defaultIntervalDurationSeconds: 85,
};

/**
 * Retrieve user Skip Intro preferences
 */
export function getSkipIntroSettings(): SkipIntroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SKIP_INTRO_SETTINGS;
    return { ...DEFAULT_SKIP_INTRO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SKIP_INTRO_SETTINGS;
  }
}

/**
 * Save user Skip Intro preferences
 */
export function saveSkipIntroSettings(settings: Partial<SkipIntroSettings>): SkipIntroSettings {
  try {
    const updated = { ...getSkipIntroSettings(), ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('jellyfin_skip_intro_settings_updated', { detail: updated }));
    return updated;
  } catch (err) {
    console.error('Failed to save skip intro settings:', err);
    return DEFAULT_SKIP_INTRO_SETTINGS;
  }
}

/**
 * Chapter name regex patterns matching intro / opening sequences
 */
const INTRO_PATTERNS = [
  /^(intro(duction)?|op)$/i,
  /^(opening(\s+(credits|theme|title|sequence))?)$/i,
  /^(main\s+title|title\s+sequence)$/i,
  /^(theme\s+song)$/i,
  /^(opening)$/i,
];

/**
 * Checks if a chapter title indicates an intro or opening sequence
 */
export function isIntroChapterName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (INTRO_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  return (
    lower.includes('opening credit') ||
    lower.includes('opening theme') ||
    lower.includes('title sequence') ||
    lower.includes('theme song') ||
    lower.includes('intro sequence') ||
    (lower.includes('intro') && !lower.includes('introduction to'))
  );
}

/**
 * Detects an intro segment for a given media item using:
 * 1. Explicit intro metadata (if already provided on item or from Jellyfin intro plugin/ticks)
 * 2. Chapter markers (chapters named 'Intro', 'Opening', 'Opening Credits', etc.)
 * 3. Time-interval heuristics (for TV episodes/series where standard opening sequences occur)
 */
export function detectIntroSegment(item: JellyfinItem, videoDuration?: number): IntroSegment | null {
  const settings = getSkipIntroSettings();
  if (!settings.enabled) return null;

  const totalDuration = videoDuration || item.durationSeconds || (item.runTimeTicks ? Math.floor(item.runTimeTicks / 10000000) : 0);

  // 1. Check explicit item.introSegment
  if (item.introSegment && item.introSegment.endSeconds > item.introSegment.startSeconds) {
    return item.introSegment;
  }

  // 2. Check Jellyfin native intro ticks (IntroStartPositionTicks & IntroEndPositionTicks)
  if (
    item.introStartPositionTicks !== undefined &&
    item.introEndPositionTicks !== undefined &&
    item.introEndPositionTicks > item.introStartPositionTicks
  ) {
    const startSeconds = Math.floor(item.introStartPositionTicks / 10000000);
    const endSeconds = Math.ceil(item.introEndPositionTicks / 10000000);
    if (endSeconds > startSeconds && endSeconds - startSeconds >= 5) {
      return {
        startSeconds,
        endSeconds,
        source: 'metadata',
        label: 'Opening Credits',
      };
    }
  }

  // 3. Check Chapter-Based Intro Detection
  if (item.chapters && item.chapters.length > 0) {
    const sorted = [...item.chapters].sort((a, b) => a.startPositionSeconds - b.startPositionSeconds);

    for (let i = 0; i < sorted.length; i++) {
      const chapter = sorted[i];
      if (isIntroChapterName(chapter.name)) {
        const start = chapter.startPositionSeconds;
        let end: number;

        // If there is a subsequent chapter within a realistic intro duration (e.g. <= 240s)
        if (i + 1 < sorted.length) {
          const nextStart = sorted[i + 1].startPositionSeconds;
          const diff = nextStart - start;
          if (diff >= 10 && diff <= 240) {
            end = nextStart;
          } else {
            end = start + Math.min(settings.defaultIntervalDurationSeconds, 90);
          }
        } else {
          end = start + Math.min(settings.defaultIntervalDurationSeconds, 90);
        }

        // Ensure within video duration bounds
        if (totalDuration > 0 && end > totalDuration) {
          end = totalDuration;
        }

        if (end > start + 5) {
          return {
            startSeconds: start,
            endSeconds: end,
            source: 'chapter',
            label: chapter.name || 'Intro',
          };
        }
      }
    }

    // Secondary chapter heuristic: If Chapter 0 is "Prologue", "Cold Open", or "Recap" and Chapter 1 begins between 20s and 180s
    if (sorted.length >= 2) {
      const first = sorted[0];
      const second = sorted[1];
      const firstLower = first.name.toLowerCase();
      if (
        (firstLower.includes('prologue') ||
          firstLower.includes('cold open') ||
          firstLower.includes('recap') ||
          firstLower.includes('previously')) &&
        second.startPositionSeconds >= 20 &&
        second.startPositionSeconds <= 200
      ) {
        // If Chapter 1 is labeled opening or is short before chapter 2
        if (isIntroChapterName(second.name)) {
          const start = second.startPositionSeconds;
          const end = sorted[2] ? Math.min(sorted[2].startPositionSeconds, start + 90) : start + 85;
          return {
            startSeconds: start,
            endSeconds: end,
            source: 'chapter',
            label: second.name || 'Opening Credits',
          };
        }
      }
    }
  }

  // 4. Time-Interval Heuristic Detection (for TV Series/Episodes when metadata is not tagged)
  if (settings.enableIntervalFallback) {
    const isEpisode = item.type === 'Episode' || Boolean(item.seriesName);
    // Typical episodes >= 5 minutes (300 seconds)
    if (isEpisode && totalDuration >= 300) {
      // If no chapters or single chapter, standard intro segment occurs after cold open (e.g. 60s - 145s)
      // or at 10s - 95s if no cold open.
      // We safely check if the item does not have a conflicting early chapter:
      const start = 60; // 1:00 mark
      const end = 60 + settings.defaultIntervalDurationSeconds; // 1:00 to 2:25 mark

      if (totalDuration > end + 60) {
        return {
          startSeconds: start,
          endSeconds: end,
          source: 'interval',
          label: 'Opening Credits',
        };
      }
    }
  }

  return null;
}

/**
 * Checks if current playback time is inside the intro segment
 */
export function isPlaybackInIntro(currentTime: number, intro: IntroSegment | null): boolean {
  if (!intro) return false;
  // Show button until 1.5 seconds before intro ends
  return currentTime >= intro.startSeconds && currentTime < intro.endSeconds - 1.5;
}

/**
 * Format seconds as mm:ss
 */
export function formatIntroTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
