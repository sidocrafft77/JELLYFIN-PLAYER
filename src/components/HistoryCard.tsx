import React from 'react';
import { JellyfinItem } from '../types';
import { WatchHistoryEntry, formatTimeAgo, formatHistoryTimestamp } from '../services/watchHistory';
import { formatResumeTimestamp } from '../services/playbackResume';
import { Play, Trash2, Clock, CheckCircle2, Film, Tv, RotateCcw } from 'lucide-react';

interface HistoryCardProps {
  entry: WatchHistoryEntry;
  onPlay: (item: JellyfinItem) => void;
  onRemove: (itemId: string) => void;
  serverUrl?: string;
  isCached?: boolean;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({
  entry,
  onPlay,
  onRemove,
  serverUrl,
  isCached,
}) => {
  const { item, lastPositionSeconds, durationSeconds, percentage, lastWatchedAt, isCompleted } = entry;

  const isEpisode = item.type === 'Episode';
  const effectiveDuration = durationSeconds || item.durationSeconds || 0;
  const positionFormatted = formatResumeTimestamp(lastPositionSeconds);
  const durationFormatted = effectiveDuration > 0 ? formatResumeTimestamp(effectiveDuration) : '';

  // Jellyfin poster/backdrop image URL if available
  const imageUrl = item.backdropImageUrl || item.primaryImageUrl;

  return (
    <div className="group relative flex flex-col bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
      {/* Thumbnail Aspect Box */}
      <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950/40 p-4 text-center">
            {isEpisode ? (
              <Tv className="w-10 h-10 text-neutral-600 mb-1" />
            ) : (
              <Film className="w-10 h-10 text-neutral-600 mb-1" />
            )}
            <span className="text-xs font-medium text-neutral-400 truncate max-w-full px-2">
              {item.name}
            </span>
          </div>
        )}

        {/* Play overlay button on hover */}
        <div
          onClick={() => onPlay(item)}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
        >
          <div className="p-3.5 rounded-full bg-indigo-600/90 text-white shadow-xl shadow-indigo-600/40 transform group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {/* Status Badge */}
          {isCompleted ? (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold backdrop-blur-md">
              <CheckCircle2 className="w-3 h-3" />
              <span>Finished</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-[10px] font-semibold backdrop-blur-md">
              <Clock className="w-3 h-3" />
              <span>{percentage}% watched</span>
            </span>
          )}

          {/* Offline Cache Indicator */}
          {isCached && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-[10px] font-medium backdrop-blur-md">
              Offline
            </span>
          )}
        </div>

        {/* Bottom Progress Bar on Thumbnail */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/80 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-amber-500 to-indigo-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Series / Episode Info */}
          {(item.seriesName || item.parentIndexNumber || item.indexNumber) && (
            <p className="text-[11px] font-medium text-indigo-400 truncate">
              {item.seriesName ? `${item.seriesName} • ` : ''}
              {item.parentIndexNumber ? `S${item.parentIndexNumber} ` : ''}
              {item.indexNumber !== undefined ? `E${item.indexNumber}` : ''}
            </p>
          )}

          {/* Title */}
          <h4
            className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors"
            title={item.name}
          >
            {item.name}
          </h4>

          {/* Last Playback Timestamp and Activity Time */}
          <div className="pt-1 flex flex-col space-y-1 text-xs">
            <div className="flex items-center justify-between text-neutral-300 bg-neutral-950/60 px-2.5 py-1.5 rounded-xl border border-neutral-800/80">
              <span className="flex items-center space-x-1.5 text-neutral-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Last position:</span>
              </span>
              <span className="font-mono text-xs font-semibold text-neutral-100">
                {formatHistoryTimestamp(lastPositionSeconds, effectiveDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-0.5">
              <span>Watched {formatTimeAgo(lastWatchedAt)}</span>
              <span>{item.type || 'Video'}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
          <button
            onClick={() => onPlay(item)}
            className={`flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              isCompleted
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
            }`}
          >
            {isCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-neutral-300" />
                <span>Watch Again</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume from {positionFormatted}</span>
              </>
            )}
          </button>

          {/* Remove from History Button */}
          <button
            onClick={() => onRemove(entry.itemId)}
            className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition"
            title="Remove from Watch History"
            aria-label="Remove from Watch History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
