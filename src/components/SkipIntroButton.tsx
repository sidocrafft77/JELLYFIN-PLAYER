import React from 'react';
import { IntroSegment } from '../types';
import { FastForward, Zap, Sparkles } from 'lucide-react';
import { formatIntroTime } from '../services/introDetection';

interface SkipIntroButtonProps {
  introSegment: IntroSegment;
  currentTime: number;
  onSkip: () => void;
  autoSkipCountdown?: number | null;
  autoSkipEnabled?: boolean;
  onToggleAutoSkip?: () => void;
}

export const SkipIntroButton: React.FC<SkipIntroButtonProps> = ({
  introSegment,
  currentTime,
  onSkip,
  autoSkipCountdown,
  autoSkipEnabled,
  onToggleAutoSkip,
}) => {
  const remainingSeconds = Math.max(0, Math.ceil(introSegment.endSeconds - currentTime));
  const totalIntroDuration = Math.max(1, introSegment.endSeconds - introSegment.startSeconds);
  const progressRatio = Math.min(
    1,
    Math.max(0, (currentTime - introSegment.startSeconds) / totalIntroDuration)
  );

  return (
    <div
      className="absolute bottom-24 right-6 sm:right-8 z-40 flex flex-col items-end space-y-1.5 animate-slideUp select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-1.5">
        <button
          onClick={onSkip}
          className="group relative flex items-center space-x-2.5 px-4 py-2.5 bg-neutral-900/95 hover:bg-indigo-950/90 text-white rounded-2xl border border-neutral-700/80 hover:border-indigo-500/80 shadow-2xl shadow-black/80 hover:shadow-indigo-600/30 backdrop-blur-md transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
          title={`Skip past opening credits to ${formatIntroTime(introSegment.endSeconds)} (Press 'S')`}
          aria-label="Skip Intro"
        >
          {/* Animated Icon */}
          <div className="p-1 rounded-lg bg-indigo-600/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <FastForward className="w-4 h-4 fill-current" />
          </div>

          {/* Text and Segment Label */}
          <div className="flex flex-col text-left">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-bold tracking-wide text-white group-hover:text-indigo-200 transition-colors">
                Skip Intro
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-400 font-mono">
                S
              </kbd>
            </div>

            <span className="text-[10px] text-neutral-400 flex items-center space-x-1">
              <span>
                {autoSkipCountdown !== null && autoSkipCountdown !== undefined
                  ? `Auto-skipping in ${autoSkipCountdown}s...`
                  : `${introSegment.label || 'Opening'} • Ends at ${formatIntroTime(introSegment.endSeconds)}`}
              </span>
              <span className="text-neutral-500">({remainingSeconds}s left)</span>
            </span>
          </div>

          {/* Progress bar at bottom of button */}
          <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 group-hover:bg-indigo-400 transition-all duration-200"
              style={{ width: `${Math.round(progressRatio * 100)}%` }}
            />
          </div>
        </button>

        {/* Quick Auto-Skip toggle button */}
        {onToggleAutoSkip && (
          <button
            onClick={onToggleAutoSkip}
            className={`p-2.5 rounded-2xl border backdrop-blur-md transition shadow-xl text-xs flex items-center justify-center ${
              autoSkipEnabled
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title={`Toggle Auto-Skip Intro (Currently ${autoSkipEnabled ? 'ON' : 'OFF'})`}
            aria-label="Toggle Auto-Skip"
          >
            <Zap className={`w-4 h-4 ${autoSkipEnabled ? 'fill-current text-amber-400' : ''}`} />
          </button>
        )}
      </div>

      {/* Auto-skip indicator info pill */}
      {autoSkipEnabled && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30 flex items-center space-x-1">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Auto-Skip is active</span>
        </span>
      )}
    </div>
  );
};
