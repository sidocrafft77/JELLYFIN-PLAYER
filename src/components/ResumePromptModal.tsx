import React, { useEffect } from 'react';
import { Play, RotateCcw, X, Clock, Bookmark } from 'lucide-react';
import { formatResumeTimestamp } from '../services/playbackResume';

interface ResumePromptModalProps {
  itemName: string;
  seriesName?: string;
  episodeInfo?: string;
  resumeSeconds: number;
  durationSeconds: number;
  percentage?: number;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

export const ResumePromptModal: React.FC<ResumePromptModalProps> = ({
  itemName,
  seriesName,
  episodeInfo,
  resumeSeconds,
  durationSeconds,
  percentage,
  onResume,
  onStartOver,
  onDismiss,
}) => {
  const calculatedPercentage =
    percentage !== undefined
      ? percentage
      : durationSeconds > 0
      ? Math.min(100, Math.max(1, Math.round((resumeSeconds / durationSeconds) * 100)))
      : 0;

  // Listen to keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onResume();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onStartOver();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume, onStartOver, onDismiss]);

  return (
    <div
      className="absolute inset-0 z-40 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn"
      onClick={(e) => {
        // Prevent click through to video
        e.stopPropagation();
      }}
    >
      <div className="relative w-full max-w-md bg-neutral-900/95 border border-neutral-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 flex flex-col space-y-5 animate-scaleUp">
        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          title="Dismiss (Esc)"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon and Title */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex-shrink-0">
            <Bookmark className="w-6 h-6 fill-amber-400/20" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Resume Playback
              </span>
              <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Saved Position</span>
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white truncate" title={itemName}>
              {itemName}
            </h3>
            {(seriesName || episodeInfo) && (
              <p className="text-xs text-neutral-400 truncate">
                {seriesName ? `${seriesName} • ` : ''}
                {episodeInfo}
              </p>
            )}
          </div>
        </div>

        {/* Progress Preview Bar */}
        <div className="space-y-2 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-200">
              {formatResumeTimestamp(resumeSeconds)}
            </span>
            <span className="text-neutral-400 font-mono text-[11px]">
              {calculatedPercentage}% of {formatResumeTimestamp(durationSeconds)}
            </span>
          </div>

          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${calculatedPercentage}%` }}
            />
          </div>

          <p className="text-[11px] text-neutral-400 pt-1 leading-relaxed">
            Would you like to pick up where you left off at{' '}
            <strong className="text-neutral-200 font-semibold">
              {formatResumeTimestamp(resumeSeconds)}
            </strong>
            , or start from the beginning?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            onClick={onResume}
            className="w-full sm:flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/30"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume from {formatResumeTimestamp(resumeSeconds)}</span>
          </button>

          <button
            onClick={onStartOver}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-850 text-neutral-200 font-medium text-xs border border-neutral-700/60 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
            <span>Start Over</span>
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-center space-x-3 text-[10px] text-neutral-400 text-center pt-1 border-t border-neutral-800/60">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">Enter</kbd> to resume</span>
          <span>•</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">B</kbd> to start over</span>
        </div>
      </div>
    </div>
  );
};
