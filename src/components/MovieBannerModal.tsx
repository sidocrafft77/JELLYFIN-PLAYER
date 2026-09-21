import React from 'react';
import { JellyfinItem } from '../types';
import { X, Play, ExternalLink, Star, Calendar, Clock, HardDrive, CheckCircle2, Film } from 'lucide-react';

interface MovieBannerModalProps {
  item: JellyfinItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (item: JellyfinItem) => void;
  onDownload?: (item: JellyfinItem) => void;
  isCached?: boolean;
  selectedGenre?: string | null;
  onGenreClick?: (genre: string) => void;
}

export const MovieBannerModal: React.FC<MovieBannerModalProps> = ({
  item,
  isOpen,
  onClose,
  onPlay,
  onDownload,
  isCached,
  selectedGenre,
  onGenreClick,
}) => {
  if (!isOpen || !item) return null;

  const bannerImg = item.bannerImageUrl || item.backdropImageUrl || item.primaryImageUrl;
  const runtimeMinutes = item.durationSeconds
    ? Math.round(item.durationSeconds / 60)
    : item.runTimeTicks
    ? Math.round(item.runTimeTicks / 10000000 / 60)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-banner-modal-title"
    >
      <div
        className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white backdrop-blur-md transition cursor-pointer border border-neutral-700/60"
          aria-label="Close banner preview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Widescreen Movie Banner Artwork */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-neutral-950 overflow-hidden">
          {bannerImg ? (
            <img
              src={bannerImg}
              alt={`${item.name} banner`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-950">
              <Film className="w-12 h-12 stroke-1" />
            </div>
          )}

          {/* Gradient vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/80 via-transparent to-transparent hidden sm:block" />

          {/* Top IMDb Source Badge */}
          <div className="absolute top-4 left-4 flex items-center space-x-2">
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f5c518] text-black font-black text-xs shadow-lg">
              <span>IMDb Official Banner</span>
            </span>
            {item.imdbId && (
              <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 font-mono text-xs border border-neutral-700/60">
                {item.imdbId}
              </span>
            )}
          </div>
        </div>

        {/* Modal Content Details */}
        <div className="p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <h2
                id="movie-banner-modal-title"
                className="text-xl sm:text-3xl font-extrabold text-white tracking-tight"
              >
                {item.name}
              </h2>
              {item.originalTitle && item.originalTitle !== item.name && (
                <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                  {item.originalTitle}
                </p>
              )}
            </div>

            {/* IMDb Link and Rating */}
            {item.imdbUrl && (
              <a
                href={item.imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#f5c518] hover:bg-[#e2b616] text-black font-extrabold text-xs sm:text-sm transition shadow-lg self-start cursor-pointer"
                title="View full film page on IMDb.com"
              >
                <span className="font-black">IMDb</span>
                {(item.imdbRating || item.communityRating) && (
                  <span className="border-l border-black/30 pl-2 font-bold">
                    ★ {(item.imdbRating || item.communityRating)?.toFixed(1)} / 10
                  </span>
                )}
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </a>
            )}
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {item.productionYear && (
              <span className="flex items-center space-x-1 text-neutral-400">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <span>{item.productionYear}</span>
              </span>
            )}

            {runtimeMinutes && (
              <span className="flex items-center space-x-1 text-neutral-400">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>{runtimeMinutes} minutes</span>
              </span>
            )}

            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-1">
                {item.genres.map((g) => {
                  const isSelected = selectedGenre?.toLowerCase() === g.toLowerCase();
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        if (onGenreClick) {
                          onGenreClick(g);
                          onClose();
                        }
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700/60'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overview text */}
          {item.overview && (
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl">
              {item.overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-800">
            <button
              onClick={() => {
                onPlay(item);
                onClose();
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Movie</span>
            </button>

            {onDownload && (
              <button
                onClick={() => onDownload(item)}
                disabled={isCached}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                  isCached
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 cursor-default'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                {isCached ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Saved Offline</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <span>Download Offline</span>
                  </>
                )}
              </button>
            )}

            {item.imdbUrl && (
              <a
                href={item.imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                <span>Open IMDb Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
