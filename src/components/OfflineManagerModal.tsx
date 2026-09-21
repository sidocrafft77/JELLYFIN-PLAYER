import React from 'react';
import { CachedOfflineMedia, DownloadProgress } from '../types';
import { formatBytes } from '../services/offlineStorage';
import { getPlaybackResume, formatResumeTimestamp } from '../services/playbackResume';
import { HardDrive, Play, Trash2, X, AlertCircle, ArrowDownCircle, CheckCircle2, Film, Bookmark } from 'lucide-react';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cachedMedia: CachedOfflineMedia[];
  onPlayCachedItem: (item: CachedOfflineMedia) => void;
  onDeleteCachedItem: (id: string) => void;
  storageStats: { usedBytes: number; quotaBytes: number; percentage: number };
  activeDownload?: DownloadProgress;
  onCancelDownload?: () => void;
}

export const OfflineManagerModal: React.FC<OfflineManagerModalProps> = ({
  isOpen,
  onClose,
  cachedMedia,
  onPlayCachedItem,
  onDeleteCachedItem,
  storageStats,
  activeDownload,
  onCancelDownload,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Offline Media Cache</h2>
              <p className="text-xs text-neutral-400">
                Videos saved in local browser storage (IndexedDB) for playback without internet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Stats Bar */}
        <div className="px-6 py-3.5 bg-neutral-950/60 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-neutral-400">Offline Storage Used:</span>
            <span className="font-semibold text-neutral-200">
              {formatBytes(storageStats.usedBytes)}
            </span>
            <span className="text-neutral-500">/ {formatBytes(storageStats.quotaBytes)} total</span>
          </div>
          <div className="w-full sm:w-48 bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, Math.min(100, storageStats.percentage))}%` }}
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Active Download Progress Card */}
          {activeDownload && activeDownload.status === 'downloading' && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-300 text-sm font-medium">
                  <ArrowDownCircle className="w-4 h-4 animate-bounce text-indigo-400" />
                  <span className="truncate max-w-[280px]">Downloading: {activeDownload.itemName}</span>
                </div>
                {onCancelDownload && (
                  <button
                    onClick={onCancelDownload}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${activeDownload.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-400 font-mono">
                <span>{activeDownload.percent}% ({formatBytes(activeDownload.loadedBytes)} / {activeDownload.totalBytes ? formatBytes(activeDownload.totalBytes) : '?'})</span>
                {activeDownload.speedBps && (
                  <span>{formatBytes(activeDownload.speedBps)}/s</span>
                )}
              </div>
            </div>
          )}

          {/* List of Cached Items */}
          {cachedMedia.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-800/80 text-neutral-500 flex items-center justify-center mx-auto">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-neutral-300">No cached media yet</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Download movies and episodes while connected to your Jellyfin server. Once cached, they can be played completely offline without any internet connection.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <span className="text-xs uppercase font-medium text-neutral-400 tracking-wider block">
                Saved Media ({cachedMedia.length})
              </span>
              {cachedMedia.map((item) => {
                const durationMin = Math.round(item.durationSeconds / 60);
                const resume = getPlaybackResume(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/40 border border-neutral-800/80 hover:border-neutral-700/80 transition"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 text-neutral-400">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-neutral-100 truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center flex-wrap gap-2 text-xs text-neutral-400 mt-0.5">
                          <span>{durationMin > 0 ? `${durationMin} min` : 'Video'}</span>
                          <span>•</span>
                          <span className="font-mono text-neutral-300">{formatBytes(item.fileSizeBytes)}</span>
                          {item.subtitles && item.subtitles.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-400 font-medium">
                                {item.subtitles.length} Subtitle{item.subtitles.length > 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                          {resume && resume.percentage > 0 && (
                            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-medium border border-amber-500/25">
                              <Bookmark className="w-2.5 h-2.5 fill-current" />
                              <span>Resume {formatResumeTimestamp(resume.positionSeconds)} ({resume.percentage}%)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          onPlayCachedItem(item);
                          onClose();
                        }}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          resume && resume.percentage > 0
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{resume && resume.percentage > 0 ? 'Resume Offline' : 'Play Offline'}</span>
                      </button>
                      <button
                        onClick={() => onDeleteCachedItem(item.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition"
                        title="Remove from offline cache"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick info tip */}
          <div className="flex items-start space-x-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400">
            <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              All video streams and their associated subtitles are stored inside this browser's local sandbox and persist across app reloads and airplane mode.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
