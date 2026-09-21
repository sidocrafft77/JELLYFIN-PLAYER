import { SubtitleCue } from '../types';

/**
 * Parses timestamp string "00:01:20,450" or "01:20.450" into total seconds
 */
export function parseTimestamp(timestampStr: string): number {
  const clean = timestampStr.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else {
    return parseFloat(clean) || 0;
  }
}

/**
 * Formats seconds to WebVTT timestamp format "00:00:00.000"
 */
export function formatTimestampVtt(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Parses SubRip (.srt) text into structured SubtitleCue items
 */
export function parseSrt(srtContent: string): SubtitleCue[] {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n');
    let timeLineIndex = 0;

    // First line might be cue index number
    if (/^\d+$/.test(lines[0].trim())) {
      timeLineIndex = 1;
    }

    if (lines.length <= timeLineIndex) continue;

    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})/);

    if (timeMatch) {
      const startTime = parseTimestamp(timeMatch[1]);
      const endTime = parseTimestamp(timeMatch[2]);
      const textLines = lines.slice(timeLineIndex + 1);
      const text = textLines.join('\n').trim();

      if (endTime > startTime && text) {
        cues.push({
          id: `cue-${i}-${startTime}`,
          startTime,
          endTime,
          text,
        });
      }
    }
  }

  // Ensure cues are sorted chronologically by start time for O(log N) binary search
  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

/**
 * Parses WebVTT (.vtt) text into structured SubtitleCue items
 */
export function parseVtt(vttContent: string): SubtitleCue[] {
  const normalized = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];

  let i = 0;
  // Skip WEBVTT header
  while (i < lines.length && (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '')) {
    if (lines[i].startsWith('NOTE')) {
      // Skip NOTE block until empty line
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
    }
    i++;
  }

  let currentCueId = '';
  let currentStart = -1;
  let currentEnd = -1;
  let currentTextLines: string[] = [];

  const flushCue = () => {
    if (currentStart >= 0 && currentEnd > currentStart && currentTextLines.length > 0) {
      cues.push({
        id: currentCueId || `cue-${cues.length}-${currentStart}`,
        startTime: currentStart,
        endTime: currentEnd,
        text: currentTextLines.join('\n').trim(),
      });
    }
    currentCueId = '';
    currentStart = -1;
    currentEnd = -1;
    currentTextLines = [];
  };

  for (; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      flushCue();
      continue;
    }

    const timeMatch = line.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})/);

    if (timeMatch) {
      currentStart = parseTimestamp(timeMatch[1]);
      currentEnd = parseTimestamp(timeMatch[2]);
    } else if (currentStart === -1) {
      // Possible cue identifier
      currentCueId = line;
    } else {
      // Text line
      currentTextLines.push(line);
    }
  }

  flushCue();
  // Ensure cues are sorted chronologically by start time for O(log N) binary search
  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

/**
 * Universal subtitle parser: detects SRT vs VTT vs plain text
 */
export function parseSubtitleText(rawContent: string, filenameHint?: string): SubtitleCue[] {
  const content = rawContent.trim();
  if (content.startsWith('WEBVTT') || (filenameHint && filenameHint.toLowerCase().endsWith('.vtt'))) {
    return parseVtt(content);
  }
  return parseSrt(content);
}

/**
 * Converts cues to standard WebVTT string representation
 */
export function cuesToWebVtt(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    vtt += `${i + 1}\n`;
    vtt += `${formatTimestampVtt(cue.startTime)} --> ${formatTimestampVtt(cue.endTime)}\n`;
    vtt += `${cue.text}\n\n`;
  }
  return vtt;
}

/**
 * Creates a browser Object URL from parsed cues
 */
export function createVttBlobUrl(cues: SubtitleCue[]): string {
  const vttText = cuesToWebVtt(cues);
  const blob = new Blob([vttText], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

/**
 * Fast binary search to find cue at adjusted time in sorted cues in O(log N) time
 */
export function findCueIndex(cues: SubtitleCue[], adjustedTime: number): number {
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (adjustedTime < cue.startTime) {
      high = mid - 1;
    } else if (adjustedTime > cue.endTime) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return -1;
}

/**
 * Finds the currently active subtitle text based on playback time and sync offset.
 * Uses O(1) sequential playback cache and O(log N) binary search on seeks.
 */
export function getActiveCueText(
  cues: SubtitleCue[],
  currentTime: number,
  offsetSeconds: number = 0,
  lastIndexRef?: { current: number }
): string | null {
  if (!cues || cues.length === 0) return null;

  const adjustedTime = currentTime - offsetSeconds;
  const lastIndex = lastIndexRef?.current ?? -1;

  // Fast path 1: Check if the last active cue is still active (normal forward playback, O(1))
  if (lastIndex >= 0 && lastIndex < cues.length) {
    const lastCue = cues[lastIndex];
    if (adjustedTime >= lastCue.startTime && adjustedTime <= lastCue.endTime) {
      return lastCue.text;
    }
    // Fast path 2: Check immediate next cue (sequential progression, O(1))
    const nextIndex = lastIndex + 1;
    if (nextIndex < cues.length) {
      const nextCue = cues[nextIndex];
      if (adjustedTime >= nextCue.startTime && adjustedTime <= nextCue.endTime) {
        if (lastIndexRef) lastIndexRef.current = nextIndex;
        return nextCue.text;
      }
    }
  }

  // Fallback: Binary search across all cues in O(log N) time
  const foundIdx = findCueIndex(cues, adjustedTime);
  if (foundIdx >= 0) {
    if (lastIndexRef) lastIndexRef.current = foundIdx;
    return cues[foundIdx].text;
  }

  return null;
}
