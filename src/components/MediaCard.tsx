import React, { useEffect, useState } from 'react';
import { DownloadProgress, JellyfinItem } from '../types';
import { Play, Download, CheckCircle2, Clock, Star, Loader2, HardDrive, Tv, Bookmark, Tag, ExternalLink, Film } from 'lucide-react';
import { formatBytes } from '../services/offlineStorage';
import { getPlaybackResume, formatResumeTimestamp, PlaybackResumeEntry } from '../services/playbackResume';

interface MediaCardProps {
  item: JellyfinItem;
  onPlay: (item: JellyfinItem) => void;
  onDownload: (item: JellyfinItem) => void;
  isCached: boolean;
  downloadProgress?: DownloadProgress;
  selectedGenre?: string | null;
  onGenreClick?: (genre: string) => void;
  onViewBanner?: (item: JellyfinItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onPlay,
  onDownload,
  isCached,
  downloadProgress,
  selectedGenre,
  onGenreClick,
  onViewBanner,
}) => {
  const [resumeData, setResumeData] = useState<PlaybackResumeEntry | null>(() => getPlaybackResume(item.id));

  useEffect(() => {
    setResumeData(getPlaybackResume(item.id));
    const handleResumeUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      if (!custom.detail || custom.detail.itemId === item.id) {
        setResumeData(getPlaybackResume(item.id));
      }
    };
    window.addEventListener('jellyfin_resume_updated', handleResumeUpdate);
    return () => window.removeEventListener('jellyfin_resume_updated', handleResumeUpdate);
  }, [item.id]);

  const isDownloading = downloadProgress?.status === 'downloading';
  const durationMin = item.durationSeconds
    ? Math.round(item.durationSeconds / 60)
    : item.runTimeTicks
    ? Math.round(item.runTimeTicks / 10000000 / 60)
    : null;

  return (
    <div
      className="group relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all duration-300 flex flex-col shadow-lg hover:shadow-indigo-500/5 active:scale-[0.99] touch-manipulation"
      style={{
        backgroundColor: 'var(--app-card-bg, #171717)',
        borderColor: 'var(--app-border, #262626)',
      }}
    >
      {/* Poster / Thumbnail Image - Tap anywhere to Play on touch screens */}
      <div
        onClick={() => onPlay(item)}
        className="relative aspect-video w-full bg-neutral-950 overflow-hidden cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Play ${item.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPlay(item);
          }
        }}
      >
        {item.bannerImageUrl || item.backdropImageUrl || item.primaryImageUrl ? (
          <img
            src={item.bannerImageUrl || item.backdropImageUrl || item.primaryImageUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-950">
            <span className="text-xs uppercase tracking-wider font-semibold">No Preview</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

        {/* Top-Right Badges: Offline cached and/or banner view trigger */}
        <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 z-10">
          {onViewBanner && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewBanner(item);
              }}
              className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white backdrop-blur-md border border-neutral-700/60 transition cursor-pointer"
              title={`View ${item.name} IMDb Banner & Info`}
              aria-label="View IMDb Banner details"
            >
              <Film className="w-3 h-3 text-[#f5c518]" />
            </button>
          )}

          {isCached && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-neutral-950 font-semibold text-[10px] sm:text-[11px] backdrop-blur-md shadow">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline sm:inline">Cached</span>
            </div>
          )}
        </div>

        {/* Top-Left Rating / IMDb Badge */}
        {item.imdbUrl ? (
          <a
            href={item.imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2.5 left-2.5 flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#f5c518] hover:bg-[#e2b616] text-black text-[10px] sm:text-xs font-black tracking-tight transition shadow-md z-10 cursor-pointer"
            title={`View ${item.name} on IMDb`}
          >
            <span className="tracking-tighter font-black">IMDb</span>
            {(item.imdbRating || item.communityRating) && (
              <span className="font-bold border-l border-black/30 pl-1">
                {(item.imdbRating || item.communityRating)?.toFixed(1)}
              </span>
            )}
            <ExternalLink className="w-2.5 h-2.5 opacity-70 ml-0.5" />
          </a>
        ) : item.communityRating ? (
          <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 text-amber-300 text-[10px] sm:text-xs font-semibold backdrop-blur-md z-10">
            <Star className="w-3 h-3 fill-current" />
            <span>{item.communityRating.toFixed(1)}</span>
          </div>
        ) : null}

        {/* Bottom-Right IMDb Movie Banner Indicator */}
        {item.bannerImageUrl && (
          <div
            className="absolute bottom-2.5 right-2.5 flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] text-neutral-200 font-medium border border-neutral-700/60 z-10 pointer-events-none"
            title="Official IMDb Movie Banner"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518]" />
            <span>IMDb Banner</span>
          </div>
        )}

        {/* Play Overlay Button (Visible on hover and touch cue) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
          <div
            className="p-3 sm:p-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 transform group-hover:scale-110 transition duration-200"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </div>
        </div>

        {/* Saved playback resume badge */}
        {resumeData && resumeData.percentage > 0 && !isDownloading && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-amber-300 text-[9px] sm:text-[10px] font-medium border border-amber-500/30 z-10">
            <Bookmark className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
            <span>Resume {formatResumeTimestamp(resumeData.positionSeconds)}</span>
          </div>
        )}

        {/* Saved playback resume progress bar */}
        {resumeData && resumeData.percentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-950/80 overflow-hidden z-10">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-r-full"
              style={{ width: `${resumeData.percentage}%` }}
            />
          </div>
        )}

        {/* In-progress download overlay */}
        {isDownloading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-3 sm:p-4 space-y-2 z-10">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Downloading {downloadProgress.percent}%</span>
            </div>
            <div className="w-3/4 bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">
              {formatBytes(downloadProgress.loadedBytes)} / {downloadProgress.totalBytes ? formatBytes(downloadProgress.totalBytes) : '...'}
            </span>
          </div>
        )}
      </div>

      {/* Item Details */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-3">
        <div>
          {item.seriesName && (
            <div className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] text-indigo-400 font-medium mb-1 truncate">
              <Tv className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{item.seriesName}</span>
              {(item.parentIndexNumber || item.indexNumber) && (
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px] sm:text-[10px] flex-shrink-0">
                  {item.parentIndexNumber ? `S${item.parentIndexNumber}:` : ''}E{item.indexNumber ?? 1}
                </span>
              )}
            </div>
          )}

          <div className="flex items-start justify-between gap-1.5">
            <h3
              onClick={() => onPlay(item)}
              className="text-xs sm:text-base font-semibold text-neutral-100 truncate cursor-pointer hover:text-indigo-300 transition"
              title={item.name}
            >
              {item.name}
            </h3>
            {item.productionYear && (
              <span className="text-[10px] sm:text-xs text-neutral-400 font-mono flex-shrink-0">
                {item.productionYear}
              </span>
            )}
          </div>

          {item.overview && (
            <p className="text-[11px] sm:text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed hidden xs:block">
              {item.overview}
            </p>
          )}

          {/* Dynamic Genre Badges & Duration */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-0.5">
            {durationMin && (
              <div
                className="flex items-center space-x-1 text-[10px] sm:text-[11px] text-neutral-400 py-0.5 pr-0.5 flex-shrink-0"
                title={`Runtime: ${durationMin} minutes`}
              >
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500" />
                <span>{durationMin}m</span>
              </div>
            )}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Genre tags">
                {item.genres.map((genre) => {
                  const isSelected = selectedGenre?.trim().toLowerCase() === genre.trim().toLowerCase();
                  return onGenreClick ? (
                    <button
                      key={genre}
                      id={`media-card-genre-${item.id}-${genre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenreClick(genre);
                      }}
                      className={`group/genre inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all duration-150 cursor-pointer active:scale-95 whitespace-nowrap ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40 ring-1 ring-indigo-400/30'
                          : 'bg-neutral-800/90 text-neutral-300 hover:text-white hover:bg-neutral-700/90 border border-neutral-700/60 hover:border-indigo-500/40'
                      }`}
                      title={
                        isSelected
                          ? `Filter active for ${genre} (click to clear filter)`
                          : `Filter all titles by genre: ${genre}`
                      }
                      aria-label={`Filter by genre: ${genre}`}
                      aria-pressed={isSelected}
                    >
                      <Tag
                        className={`w-2.5 h-2.5 flex-shrink-0 transition-colors ${
                          isSelected ? 'text-indigo-200 fill-current' : 'text-indigo-400 group-hover/genre:text-indigo-300'
                        }`}
                      />
                      <span className="truncate max-w-[120px]">{genre}</span>
                    </button>
                  ) : (
                    <span
                      key={genre}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-300 text-[10px] sm:text-[11px] font-medium border border-neutral-700/50"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      <span className="truncate max-w-[120px]">{genre}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-1">
          <button
            onClick={() => onPlay(item)}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[38px] ${
              resumeData && resumeData.percentage > 0
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{resumeData && resumeData.percentage > 0 ? 'Resume' : 'Play'}</span>
          </button>

          <button
            onClick={() => onDownload(item)}
            disabled={isCached || isDownloading}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer min-h-[38px] ${
              isCached
                ? 'text-emerald-400 bg-emerald-500/10 cursor-default'
                : isDownloading
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title={isCached ? 'Already downloaded offline' : 'Download and cache for offline viewing'}
          >
            {isCached ? (
              <>
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Offline</span>
              </>
            ) : isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span className="text-[11px]">{downloadProgress.percent}%</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
