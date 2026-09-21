import React from 'react';
import { DownloadProgress, JellyfinItem } from '../types';
import { Play, Download, CheckCircle2, Clock, Star, Loader2, HardDrive, Tag, ExternalLink, Film } from 'lucide-react';
import { formatBytes } from '../services/offlineStorage';

interface MovieBannerCardProps {
  item: JellyfinItem;
  onPlay: (item: JellyfinItem) => void;
  onDownload: (item: JellyfinItem) => void;
  isCached: boolean;
  downloadProgress?: DownloadProgress;
  selectedGenre?: string | null;
  onGenreClick?: (genre: string) => void;
  onViewBanner?: (item: JellyfinItem) => void;
}

export const MovieBannerCard: React.FC<MovieBannerCardProps> = ({
  item,
  onPlay,
  onDownload,
  isCached,
  downloadProgress,
  selectedGenre,
  onGenreClick,
  onViewBanner,
}) => {
  const isDownloading = downloadProgress?.status === 'downloading';
  const bannerSrc = item.bannerImageUrl || item.backdropImageUrl || item.primaryImageUrl;
  const runtimeMinutes = item.durationSeconds
    ? Math.round(item.durationSeconds / 60)
    : item.runTimeTicks
    ? Math.round(item.runTimeTicks / 10000000 / 60)
    : null;

  return (
    <div
      className="group relative bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden hover:border-neutral-700 transition-all duration-300 shadow-xl flex flex-col md:flex-row hover:shadow-indigo-500/10"
      style={{
        backgroundColor: 'var(--app-card-bg, #171717)',
        borderColor: 'var(--app-border, #262626)',
      }}
    >
      {/* Left Widescreen Banner Section */}
      <div
        onClick={() => onPlay(item)}
        className="relative aspect-video md:aspect-[16/10] md:w-2/5 lg:w-1/2 bg-neutral-950 overflow-hidden cursor-pointer flex-shrink-0"
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
        {bannerSrc ? (
          <img
            src={bannerSrc}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-950">
            <Film className="w-10 h-10 stroke-1" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-neutral-900/60 hidden md:block" />

        {/* Top-Left IMDb Golden Rating Badge */}
        {item.imdbUrl ? (
          <a
            href={item.imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#f5c518] hover:bg-[#e2b616] text-black text-xs font-black tracking-tight transition shadow-md z-10 cursor-pointer"
            title={`View ${item.name} on IMDb`}
          >
            <span>IMDb</span>
            {(item.imdbRating || item.communityRating) && (
              <span className="font-bold border-l border-black/30 pl-1.5">
                {(item.imdbRating || item.communityRating)?.toFixed(1)}
              </span>
            )}
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>
        ) : item.communityRating ? (
          <div className="absolute top-3 left-3 flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-black/70 text-amber-300 text-xs font-semibold backdrop-blur-md z-10">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{item.communityRating.toFixed(1)}</span>
          </div>
        ) : null}

        {/* Bottom Banner Tag */}
        {item.bannerImageUrl && (
          <div className="absolute bottom-3 left-3 flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] text-neutral-200 font-medium border border-neutral-700/60 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518]" />
            <span>IMDb Banner</span>
          </div>
        )}

        {/* Play overlay button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
          <div className="p-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/50 transform group-hover:scale-110 transition duration-200">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </div>

        {/* Downloading overlay */}
        {isDownloading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 space-y-2 z-20">
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

      {/* Right Movie Info Section */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Header title & year */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                onClick={() => onPlay(item)}
                className="text-lg sm:text-2xl font-bold text-neutral-100 hover:text-indigo-300 transition cursor-pointer tracking-tight"
              >
                {item.name}
              </h3>
              {item.originalTitle && item.originalTitle !== item.name && (
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  {item.originalTitle}
                </p>
              )}
            </div>

            {item.productionYear && (
              <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-mono font-semibold border border-neutral-700/60 flex-shrink-0">
                {item.productionYear}
              </span>
            )}
          </div>

          {/* Runtime & Genres */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {runtimeMinutes && (
              <div className="flex items-center space-x-1 text-xs text-neutral-400">
                <Clock className="w-3 h-3 text-neutral-500" />
                <span>{runtimeMinutes}m</span>
              </div>
            )}

            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Genre tags">
                {item.genres.map((genre) => {
                  const isSelected = selectedGenre?.trim().toLowerCase() === genre.trim().toLowerCase();
                  return onGenreClick ? (
                    <button
                      key={genre}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenreClick(genre);
                      }}
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 border border-indigo-400/40'
                          : 'bg-neutral-800/90 text-neutral-300 hover:text-white hover:bg-neutral-700/90 border border-neutral-700/60'
                      }`}
                      title={isSelected ? `Filter active for ${genre} (click to clear)` : `Filter by genre: ${genre}`}
                    >
                      <Tag className={`w-2.5 h-2.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                      <span>{genre}</span>
                    </button>
                  ) : (
                    <span
                      key={genre}
                      className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-700/50"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      <span>{genre}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overview */}
          {item.overview && (
            <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed pt-1">
              {item.overview}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPlay(item)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </button>

            <button
              onClick={() => onDownload(item)}
              disabled={isCached || isDownloading}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition border cursor-pointer ${
                isCached
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 cursor-default'
                  : isDownloading
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  : 'bg-neutral-800/80 hover:bg-neutral-750 border-neutral-700 text-neutral-200'
              }`}
            >
              {isCached ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cached</span>
                </>
              ) : isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{downloadProgress.percent}%</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Save Offline</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {onViewBanner && (
              <button
                type="button"
                onClick={() => onViewBanner(item)}
                className="flex items-center space-x-1 px-2.5 py-2 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 text-xs font-medium transition cursor-pointer"
                title="View full IMDb banner and poster details"
              >
                <Film className="w-3.5 h-3.5 text-[#f5c518]" />
                <span className="hidden sm:inline">Banner Details</span>
              </button>
            )}

            {item.imdbUrl && (
              <a
                href={item.imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2.5 py-2 rounded-xl bg-[#f5c518]/15 hover:bg-[#f5c518]/25 text-[#f5c518] hover:text-white border border-[#f5c518]/30 text-xs font-bold transition cursor-pointer"
                title="Open title page on IMDb.com"
              >
                <span>IMDb</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
