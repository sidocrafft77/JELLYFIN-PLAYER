import React, { useRef } from 'react';
import { JellyfinItem } from '../types';
import { WatchHistoryEntry, formatTimeAgo, formatHistoryTimestamp, calculateTotalMinutesWatched, formatMinutesHuman } from '../services/watchHistory';
import { formatResumeTimestamp } from '../services/playbackResume';
import {
  Play,
  Clock,
  CheckCircle2,
  Film,
  Tv,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Trash2,
  Timer,
} from 'lucide-react';

interface ContinueWatchingSectionProps {
  items: WatchHistoryEntry[];
  onPlay: (item: JellyfinItem) => void;
  onRemove: (itemId: string) => void;
  onViewAllHistory?: () => void;
  cachedItemIds?: Set<string>;
}

export const ContinueWatchingSection: React.FC<ContinueWatchingSectionProps> = ({
  items,
  onPlay,
  onRemove,
  onViewAllHistory,
  cachedItemIds,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Take the most recent 5 items
  const recentItems = items.slice(0, 5);
  const totalMinutesWatched = calculateTotalMinutesWatched(items);
  const humanTime = formatMinutesHuman(totalMinutesWatched);

  if (recentItems.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section
      id="continue-watching-section"
      className="w-full bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 sm:p-5 backdrop-blur-md space-y-3.5 shadow-sm"
      aria-label="Continue Watching"
    >
      {/* Header with Title, Count, Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h3 id="continue-watching-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
                Continue Watching
              </h3>
              <span
                id="continue-watching-badge"
                className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold"
              >
                {recentItems.length} {recentItems.length === 1 ? 'title' : 'titles'}
              </span>
              <span
                id="continue-watching-total-time-badge"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/60 text-[11px] font-medium"
                title="Total minutes watched across all history records"
              >
                <Timer className="w-3 h-3 text-indigo-400" />
                <span>{totalMinutesWatched.toLocaleString()} mins watched ({humanTime})</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Pick up right where you left off
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onViewAllHistory && items.length > 0 && (
            <button
              id="continue-watching-view-all-btn"
              onClick={onViewAllHistory}
              className="hidden sm:flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1.5 rounded-xl hover:bg-neutral-800/80 transition cursor-pointer"
            >
              <span>Full History ({items.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Left/Right scroll controls */}
          <div className="flex items-center space-x-1">
            <button
              id="continue-watching-scroll-left"
              type="button"
              onClick={() => scroll('left')}
              className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="continue-watching-scroll-right"
              type="button"
              onClick={() => scroll('right')}
              className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Row */}
      <div
        id="continue-watching-list"
        ref={scrollContainerRef}
        className="flex items-stretch gap-4 overflow-x-auto scrollbar-none py-1 px-0.5 scroll-smooth"
      >
        {recentItems.map((entry) => {
          const { item, lastPositionSeconds, durationSeconds, percentage, isCompleted } = entry;
          const isEpisode = item.type === 'Episode';
          const effectiveDuration = durationSeconds || item.durationSeconds || 0;
          const imageUrl = item.backdropImageUrl || item.primaryImageUrl;
          const isCached = cachedItemIds?.has(entry.itemId);
          const posFormatted = formatResumeTimestamp(lastPositionSeconds);
          const safePercent = Math.min(100, Math.max(0, percentage || 0));

          return (
            <div
              key={entry.itemId}
              id={`continue-watching-card-${entry.itemId}`}
              className="group relative flex flex-col w-[260px] sm:w-[285px] shrink-0 bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
            >
              {/* Thumbnail Container */}
              <div
                className="relative aspect-video w-full bg-neutral-950 overflow-hidden cursor-pointer"
                onClick={() => onPlay(item)}
              >
                {imageUrl ? (
                  <img
                    id={`continue-watching-img-${entry.itemId}`}
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
                      <Tv className="w-8 h-8 text-neutral-600 mb-1" />
                    ) : (
                      <Film className="w-8 h-8 text-neutral-600 mb-1" />
                    )}
                    <span className="text-xs font-medium text-neutral-400 truncate max-w-full px-2">
                      {item.name}
                    </span>
                  </div>
                )}

                {/* Hover Play Backdrop Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <div className="p-3 rounded-full bg-indigo-600/95 text-white shadow-lg shadow-indigo-600/40 transform group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Status Badges */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  {isCompleted ? (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold backdrop-blur-md">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Completed</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/75 border border-white/10 text-amber-300 text-[10px] font-semibold backdrop-blur-md">
                      <Clock className="w-2.5 h-2.5 text-amber-400" />
                      <span>{safePercent}%</span>
                    </span>
                  )}

                  {isCached && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-950/90 border border-indigo-500/30 text-indigo-300 text-[10px] font-medium backdrop-blur-md">
                      Offline
                    </span>
                  )}
                </div>

                {/* Completion Progress Bar on Thumbnail */}
                <div
                  id={`continue-watching-progress-bar-track-${entry.itemId}`}
                  className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/90 overflow-hidden"
                >
                  <div
                    id={`continue-watching-progress-bar-fill-${entry.itemId}`}
                    className={`h-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-amber-500 via-indigo-400 to-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, safePercent))}%` }}
                    role="progressbar"
                    aria-valuenow={safePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                <div className="space-y-1">
                  {/* Series info if TV episode */}
                  {(item.seriesName || item.parentIndexNumber || item.indexNumber) && (
                    <p className="text-[10px] font-medium text-indigo-400 truncate">
                      {item.seriesName ? `${item.seriesName} • ` : ''}
                      {item.parentIndexNumber ? `S${item.parentIndexNumber} ` : ''}
                      {item.indexNumber !== undefined ? `E${item.indexNumber}` : ''}
                    </p>
                  )}

                  {/* Title */}
                  <h4
                    className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors"
                    title={item.name}
                  >
                    {item.name}
                  </h4>

                  {/* Playback timestamp status */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                    <span className="font-mono text-neutral-300 font-medium">
                      {posFormatted}
                      {effectiveDuration > 0 && (
                        <span className="text-neutral-500 font-normal">
                          {' '}/ {formatResumeTimestamp(effectiveDuration)}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {isCompleted ? 'Finished' : `${safePercent}% watched`}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-1.5">
                  <button
                    id={`continue-watching-play-btn-${entry.itemId}`}
                    type="button"
                    onClick={() => onPlay(item)}
                    className={`flex-1 flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isCompleted
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <RotateCcw className="w-3 h-3 text-neutral-300" />
                        <span>Replay</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>

                  <button
                    id={`continue-watching-remove-btn-${entry.itemId}`}
                    type="button"
                    onClick={() => onRemove(entry.itemId)}
                    className="p-1.5 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition cursor-pointer"
                    title="Remove from history"
                    aria-label="Remove from history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
