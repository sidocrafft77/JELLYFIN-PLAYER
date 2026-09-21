import React, { useState, useEffect, useRef, useCallback } from 'react';
import { JellyfinItem } from '../types';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  Calendar,
  HardDrive,
  CheckCircle2,
  FastForward,
  Pause,
  Film,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface MovieSliderProps {
  movies: JellyfinItem[];
  onPlay: (item: JellyfinItem) => void;
  onDownload?: (item: JellyfinItem) => void;
  cachedItemIds?: Set<string>;
  activeDownloadItemId?: string;
  selectedGenre?: string | null;
  onGenreClick?: (genre: string) => void;
  onViewBanner?: (item: JellyfinItem) => void;
}

const SLIDE_DURATION_MS = 6000;

function formatRuntime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
}

export const MovieSlider: React.FC<MovieSliderProps> = ({
  movies,
  onPlay,
  onDownload,
  cachedItemIds,
  activeDownloadItemId,
  selectedGenre,
  onGenreClick,
  onViewBanner,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);

  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const timerStartTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  const totalMovies = movies.length;

  // Ensure currentIndex stays within bounds when movies change
  useEffect(() => {
    if (currentIndex >= totalMovies && totalMovies > 0) {
      setCurrentIndex(0);
    }
  }, [totalMovies, currentIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, totalMovies));
    setProgress(0);
    timerStartTimeRef.current = Date.now();
  }, [totalMovies]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalMovies) % Math.max(1, totalMovies));
    setProgress(0);
    timerStartTimeRef.current = Date.now();
  }, [totalMovies]);

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
    timerStartTimeRef.current = Date.now();
  };

  // Auto-advance slideshow timer with smooth progress bar
  useEffect(() => {
    if (totalMovies <= 1 || isPaused || isHovered) {
      return;
    }

    timerStartTimeRef.current = Date.now();
    setProgress(0);

    const updateProgress = () => {
      const elapsed = Date.now() - timerStartTimeRef.current;
      const ratio = Math.min(1, elapsed / SLIDE_DURATION_MS);
      setProgress(ratio);

      if (ratio >= 1) {
        goToNext();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIndex, isPaused, isHovered, totalMovies, goToNext]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrev();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Keyboard navigation when focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrev();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPaused((prev) => !prev);
    }
  };

  if (totalMovies === 0) {
    return null;
  }

  const currentMovie = movies[currentIndex];
  if (!currentMovie) return null;

  const isCached = cachedItemIds?.has(currentMovie.id);
  const isDownloading = activeDownloadItemId === currentMovie.id;

  const runtimeText = currentMovie.durationSeconds
    ? formatRuntime(currentMovie.durationSeconds)
    : currentMovie.runTimeTicks
    ? formatRuntime(Math.floor(currentMovie.runTimeTicks / 10000000))
    : null;

  return (
    <section
      className="relative w-full rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl transition-all duration-300 select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Available Movies Slide"
    >
      {/* Background Backdrop Artwork with Fade Transition */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] md:min-h-[380px] lg:min-h-[440px] w-full overflow-hidden rounded-3xl bg-neutral-950">
        {currentMovie.bannerImageUrl || currentMovie.backdropImageUrl || currentMovie.primaryImageUrl ? (
          <img
            id="movie-slider-featured-thumbnail"
            key={currentMovie.id}
            src={currentMovie.bannerImageUrl || currentMovie.backdropImageUrl || currentMovie.primaryImageUrl}
            alt={currentMovie.name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center rounded-3xl transform scale-100 group-hover:scale-105 transition-transform duration-1000 ease-out animate-fadeIn"
          />
        ) : (
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-neutral-900 via-indigo-950/40 to-neutral-950" />
        )}

        {/* Multi-layered cinematic gradient vignettes */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent sm:w-3/4" />
        <div className="absolute inset-0 bg-neutral-950/20 backdrop-blur-[1px]" />

        {/* Top Header Controls Bar */}
        <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-8 sm:right-8 flex items-center justify-between z-20 pointer-events-auto">
          {/* Label badge and IMDb link */}
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-white font-semibold text-xs border border-indigo-400/40 shadow-lg">
              <Film className="w-3.5 h-3.5 text-indigo-200" />
              <span>Available Movies</span>
            </span>
            {currentMovie.imdbUrl && (
              <a
                href={currentMovie.imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f5c518] hover:bg-[#e2b616] text-black font-extrabold text-xs transition shadow-lg cursor-pointer"
                title={`View ${currentMovie.name} on IMDb`}
              >
                <span className="font-black">IMDb</span>
                {(currentMovie.imdbRating || currentMovie.communityRating) && (
                  <span className="font-bold border-l border-black/30 pl-1.5">
                    {(currentMovie.imdbRating || currentMovie.communityRating)?.toFixed(1)}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 opacity-80 ml-0.5" />
              </a>
            )}
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-neutral-300 text-xs font-mono border border-neutral-700/60">
              {String(currentIndex + 1).padStart(2, '0')} / {String(totalMovies).padStart(2, '0')}
            </span>
          </div>

          {/* Slide Arrow Controls and Pause Button */}
          <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md border border-neutral-700/60 p-1 rounded-2xl shadow-xl">
            <button
              onClick={goToPrev}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Previous movie (Left Arrow)"
              aria-label="Previous movie"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title={isPaused ? 'Resume auto-slideshow (Space)' : 'Pause auto-slideshow (Space)'}
              aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current text-indigo-400" /> : <Pause className="w-4 h-4 text-indigo-400" />}
            </button>

            <button
              onClick={goToNext}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Next movie (Right Arrow)"
              aria-label="Next movie"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content Container (Title, Synopsis, Metadata, Action Buttons) */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-5 sm:p-8 md:p-10 pb-16 sm:pb-16 pointer-events-none">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pointer-events-auto max-w-5xl">
            {/* Left Movie Info */}
            <div className="space-y-3 max-w-2xl">
              {/* Genres / Metadata Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {currentMovie.genres && currentMovie.genres.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {currentMovie.genres.slice(0, 3).map((genre) => {
                      const isSelected = selectedGenre?.toLowerCase() === genre.toLowerCase();
                      return onGenreClick ? (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => onGenreClick(genre)}
                          className={`px-2 py-0.5 rounded-lg font-medium text-[11px] transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40'
                              : 'bg-neutral-800/80 backdrop-blur-md text-neutral-300 hover:text-white hover:bg-neutral-700/80 border border-neutral-700/60'
                          }`}
                          title={`Filter by genre: ${genre}`}
                        >
                          {genre}
                        </button>
                      ) : (
                        <span
                          key={genre}
                          className="px-2 py-0.5 rounded-lg bg-neutral-800/80 backdrop-blur-md text-neutral-300 border border-neutral-700/60 font-medium text-[11px]"
                        >
                          {genre}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Star Community Rating */}
                {currentMovie.communityRating && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 text-[11px]">
                    <Star className="w-3 h-3 fill-current text-amber-400" />
                    <span>{currentMovie.communityRating.toFixed(1)}</span>
                  </span>
                )}

                {/* Production Year */}
                {currentMovie.productionYear && (
                  <span className="flex items-center space-x-1 text-neutral-400 text-[11px]">
                    <Calendar className="w-3 h-3 text-neutral-500" />
                    <span>{currentMovie.productionYear}</span>
                  </span>
                )}

                {/* Duration */}
                {runtimeText && (
                  <span className="flex items-center space-x-1 text-neutral-400 text-[11px]">
                    <Clock className="w-3 h-3 text-neutral-500" />
                    <span>{runtimeText}</span>
                  </span>
                )}

                {/* Skip Intro Available Badge */}
                {currentMovie.introSegment && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30 text-[10px]">
                    <FastForward className="w-3 h-3" />
                    <span>Skip Intro Ready</span>
                  </span>
                )}

                {/* Offline Cached Badge */}
                {isCached && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Cached Offline</span>
                  </span>
                )}
              </div>

              {/* Movie Title */}
              <div>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight drop-shadow-md leading-tight">
                  {currentMovie.name}
                </h2>
                {currentMovie.originalTitle && currentMovie.originalTitle !== currentMovie.name && (
                  <p className="text-xs sm:text-sm text-neutral-400 font-medium mt-0.5">
                    {currentMovie.originalTitle}
                  </p>
                )}
              </div>

              {/* Movie Overview / Synopsis */}
              {currentMovie.overview && (
                <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl text-shadow-sm">
                  {currentMovie.overview}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onPlay(currentMovie)}
                  className="flex items-center space-x-2.5 px-6 py-2.5 sm:py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-indigo-600/30 transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play Movie</span>
                </button>

                {onDownload && (
                  <button
                    onClick={() => onDownload(currentMovie)}
                    disabled={isCached || isDownloading}
                    className={`flex items-center space-x-2 px-4 py-2.5 sm:py-3 rounded-2xl border text-xs sm:text-sm font-semibold transition backdrop-blur-md cursor-pointer ${
                      isCached
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 cursor-default'
                        : isDownloading
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400 cursor-wait'
                        : 'bg-black/60 hover:bg-neutral-800/80 border-neutral-700/80 text-white'
                    }`}
                  >
                    {isCached ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Offline Ready</span>
                      </>
                    ) : isDownloading ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        <span>Save Offline</span>
                      </>
                    )}
                  </button>
                )}

                {onViewBanner && (
                  <button
                    type="button"
                    onClick={() => onViewBanner(currentMovie)}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 sm:py-3 rounded-2xl border border-neutral-700/80 bg-black/60 hover:bg-neutral-800/80 text-neutral-200 hover:text-white text-xs sm:text-sm font-semibold transition backdrop-blur-md cursor-pointer"
                    title="View IMDb Banner and Artwork Details"
                  >
                    <Film className="w-4 h-4 text-[#f5c518]" />
                    <span>Banner Details</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Side Floating Poster (Desktop / Tablet) */}
            {currentMovie.primaryImageUrl && (
              <div
                onClick={() => onPlay(currentMovie)}
                className="hidden lg:block relative w-36 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-neutral-700/60 hover:border-indigo-500/80 transition-all duration-300 cursor-pointer transform hover:scale-105 group/poster flex-shrink-0"
                title={`Click to play ${currentMovie.name}`}
              >
                <img
                  src={currentMovie.primaryImageUrl}
                  alt={currentMovie.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="p-3 rounded-full bg-indigo-600 text-white shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Slide Indicator Bar & Mini Selector Chips */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent p-3 sm:px-8 flex items-center justify-between gap-4 pointer-events-auto">
          {/* Mini Thumbnail Navigation Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none py-1 max-w-full">
            {movies.map((movie, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={movie.id}
                  onClick={() => goToIndex(idx)}
                  className={`group/tab relative flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-medium cursor-pointer flex-shrink-0 ${
                    isActive
                      ? 'bg-neutral-800 text-white border-indigo-500 shadow-lg shadow-indigo-500/10'
                      : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 border-neutral-800'
                  }`}
                  title={`View ${movie.name}`}
                >
                  {/* Thumbnail */}
                  {(movie.primaryImageUrl || movie.backdropImageUrl) && (
                    <img
                      src={movie.primaryImageUrl || movie.backdropImageUrl}
                      alt={movie.name}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <span className="truncate max-w-[110px] sm:max-w-[150px]">
                    {movie.name}
                  </span>

                  {/* Active progress bar indicator at bottom of tab */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dots on small screens */}
          <div className="hidden sm:flex items-center space-x-1.5 flex-shrink-0">
            {movies.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-indigo-500'
                    : 'w-1.5 bg-neutral-700 hover:bg-neutral-500'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
