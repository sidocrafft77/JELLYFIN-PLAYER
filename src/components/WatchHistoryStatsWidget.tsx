import React from 'react';
import { WatchHistoryEntry, calculateTotalMinutesWatched, calculateTotalSecondsWatched, formatMinutesHuman } from '../services/watchHistory';
import { Clock, Film, CheckCircle2, PlayCircle, Timer, BarChart2 } from 'lucide-react';

interface WatchHistoryStatsWidgetProps {
  entries: WatchHistoryEntry[];
}

export const WatchHistoryStatsWidget: React.FC<WatchHistoryStatsWidgetProps> = ({ entries }) => {
  const totalEntries = entries.length;
  if (totalEntries === 0) {
    return null;
  }

  const totalMinutes = calculateTotalMinutesWatched(entries);
  const totalSeconds = calculateTotalSecondsWatched(entries);
  const humanReadableTime = formatMinutesHuman(totalMinutes);
  const completedCount = entries.filter((e) => e.isCompleted).length;
  const inProgressCount = totalEntries - completedCount;

  // Average completion rate across records
  const averagePercentage = Math.round(
    entries.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalEntries
  );

  return (
    <div
      id="history-stats-dashboard"
      className="bg-neutral-900/80 border border-neutral-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-sm space-y-4 shadow-sm"
      aria-label="Watch History Analytics"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              Viewing Statistics Dashboard
            </h4>
            <p className="text-xs text-neutral-400">
              Aggregated watch time and engagement metrics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
            {totalEntries} {totalEntries === 1 ? 'Record' : 'Records'} Tracked
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Primary Focus: Total Minutes Watched */}
        <div
          id="stat-total-minutes-watched-card"
          className="relative overflow-hidden bg-gradient-to-br from-indigo-950/40 via-neutral-900 to-neutral-900/90 border border-indigo-500/30 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-indigo-300">
              Total Minutes Watched
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span
                id="stat-total-minutes-value"
                className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
              >
                {totalMinutes.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-indigo-400">mins</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Equivalent to ~{humanReadableTime}</span>
            </p>
          </div>
        </div>

        {/* Titles In History */}
        <div
          id="stat-titles-tracked-card"
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-neutral-300">
              Titles Watched
            </span>
            <div className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {totalEntries}
              </span>
              <span className="text-xs font-medium text-neutral-500">items</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Active in your media catalog
            </p>
          </div>
        </div>

        {/* Completed Titles */}
        <div
          id="stat-completed-titles-card"
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-neutral-300">
              Finished Titles
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {completedCount}
              </span>
              <span className="text-xs font-medium text-neutral-500">
                / {totalEntries}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Watched to completion (≥95%)
            </p>
          </div>
        </div>

        {/* In-Progress Titles & Avg Progress */}
        <div
          id="stat-in-progress-card"
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-neutral-300">
              Avg Video Progress
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <PlayCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {averagePercentage}%
              </span>
              <span className="text-xs font-medium text-neutral-500">
                ({inProgressCount} in progress)
              </span>
            </div>
            {/* Mini Progress Bar */}
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, averagePercentage))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
