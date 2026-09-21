import { CachedOfflineMedia, DownloadProgress, JellyfinItem } from '../types';

const DB_NAME = 'jellyfin_offline_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'cached_videos';

let dbInstance: IDBDatabase | null = null;

export async function getOfflineDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Save media and its blob into IndexedDB
 */
export async function saveOfflineMedia(media: CachedOfflineMedia): Promise<void> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(media);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve all offline cached media items
 */
export async function getAllOfflineMedia(): Promise<CachedOfflineMedia[]> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get single offline cached item by id
 */
export async function getOfflineMediaById(id: string): Promise<CachedOfflineMedia | null> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a media item from offline cache
 */
export async function deleteOfflineMedia(id: string): Promise<void> {
  const db = await getOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get device storage quota and usage
 */
export async function getStorageUsageEstimate(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  percentage: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1024 * 1024 * 1024 * 5; // default 5GB fallback
      return {
        usedBytes: used,
        quotaBytes: quota,
        percentage: Math.min(100, Math.round((used / quota) * 100)),
      };
    } catch {
      // Fallback
    }
  }

  // Fallback estimate by summing cached items
  try {
    const items = await getAllOfflineMedia();
    const used = items.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);
    const quota = 10 * 1024 * 1024 * 1024; // 10 GB
    return {
      usedBytes: used,
      quotaBytes: quota,
      percentage: Math.min(100, Math.round((used / quota) * 100)),
    };
  } catch {
    return { usedBytes: 0, quotaBytes: 10 * 1024 * 1024 * 1024, percentage: 0 };
  }
}

/**
 * Download helper with stream progress reporting and abort support
 */
export async function downloadMediaForOffline(
  item: JellyfinItem,
  streamUrl: string,
  subtitlesToSave: Array<{ id: string; label: string; language?: string; rawText: string; format: 'srt' | 'vtt' }>,
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<CachedOfflineMedia> {
  const startTime = Date.now();
  onProgress({
    itemId: item.id,
    itemName: item.name,
    status: 'downloading',
    loadedBytes: 0,
    totalBytes: 0,
    percent: 0,
  });

  const response = await fetch(streamUrl, {
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch media stream (${response.status}: ${response.statusText})`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
  const contentType = response.headers.get('content-type') || 'video/mp4';

  const reader = response.body?.getReader();
  if (!reader) {
    // Fallback if reader not supported
    const blob = await response.blob();
    const cachedItem: CachedOfflineMedia = {
      id: item.id,
      name: item.name,
      overview: item.overview,
      type: item.type === 'Series' ? 'Video' : item.type,
      durationSeconds: item.durationSeconds || (item.runTimeTicks ? Math.floor(item.runTimeTicks / 10000000) : 0),
      productionYear: item.productionYear,
      genres: item.genres,
      cachedAt: Date.now(),
      videoBlob: blob,
      mimeType: contentType,
      fileSizeBytes: blob.size,
      subtitles: subtitlesToSave,
    };
    await saveOfflineMedia(cachedItem);
    onProgress({
      itemId: item.id,
      itemName: item.name,
      status: 'completed',
      loadedBytes: blob.size,
      totalBytes: blob.size,
      percent: 100,
    });
    return cachedItem;
  }

  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  let lastProgressTime = 0;

  try {
    while (true) {
      if (abortSignal?.aborted) {
        await reader.cancel('Download aborted by user').catch(() => {});
        throw new Error('Download aborted by user');
      }

      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value as BlobPart);
        loadedBytes += value.length;

        const now = Date.now();
        // Throttle progress updates to at most once per 150ms to keep main thread and UI responsive
        if (now - lastProgressTime >= 150) {
          lastProgressTime = now;
          const elapsedSec = (now - startTime) / 1000;
          const speedBps = elapsedSec > 0 ? loadedBytes / elapsedSec : 0;
          const percent = totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : 0;

          onProgress({
            itemId: item.id,
            itemName: item.name,
            status: 'downloading',
            loadedBytes,
            totalBytes,
            percent,
            speedBps,
          });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const videoBlob = new Blob(chunks, { type: contentType });

  // Optional: fetch poster image blob for offline cover art
  let posterBlob: Blob | undefined;
  if (item.primaryImageUrl) {
    try {
      const posterRes = await fetch(item.primaryImageUrl);
      if (posterRes.ok) {
        posterBlob = await posterRes.blob();
      }
    } catch {
      // Ignore poster fetch error
    }
  }

  const cachedItem: CachedOfflineMedia = {
    id: item.id,
    name: item.name,
    overview: item.overview,
    type: item.type === 'Series' ? 'Video' : item.type,
    durationSeconds: item.durationSeconds || (item.runTimeTicks ? Math.floor(item.runTimeTicks / 10000000) : 0),
    productionYear: item.productionYear,
    genres: item.genres,
    cachedAt: Date.now(),
    videoBlob,
    mimeType: contentType,
    fileSizeBytes: videoBlob.size,
    posterBlob,
    subtitles: subtitlesToSave,
    chapters: item.chapters,
    introSegment: item.introSegment,
    seriesName: item.seriesName,
    seriesId: item.seriesId,
    seasonName: item.seasonName,
    seasonId: item.seasonId,
    indexNumber: item.indexNumber,
    parentIndexNumber: item.parentIndexNumber,
  };

  await saveOfflineMedia(cachedItem);

  onProgress({
    itemId: item.id,
    itemName: item.name,
    status: 'completed',
    loadedBytes: videoBlob.size,
    totalBytes: videoBlob.size,
    percent: 100,
  });

  return cachedItem;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
