import React from 'react';
import { MediaSortOption } from '../types';
import { ArrowUpDown, ChevronDown, Calendar, ArrowDownAZ, Clock, LayoutGrid, Film } from 'lucide-react';

interface MediaGridHeaderProps {
  title: string;
  count: number;
  sortBy: MediaSortOption;
  onSortChange: (newSort: MediaSortOption) => void;
  sortOrder?: 'asc' | 'desc';
  onToggleSortOrder?: () => void;
  viewLayout?: 'grid' | 'banner';
  onViewLayoutChange?: (layout: 'grid' | 'banner') => void;
}

export const MediaGridHeader: React.FC<MediaGridHeaderProps> = ({
  title,
  count,
  sortBy,
  onSortChange,
  sortOrder = 'desc',
  onToggleSortOrder,
  viewLayout = 'grid',
  onViewLayoutChange,
}) => {
  const getSortIcon = () => {
    switch (sortBy) {
      case 'recently_added':
        return <Clock className="w-3.5 h-3.5 text-indigo-400" />;
      case 'alphabetical':
        return <ArrowDownAZ className="w-3.5 h-3.5 text-indigo-400" />;
      case 'release_year':
        return <Calendar className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div
      id="media-grid-header"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 pt-1 border-b border-neutral-800/80"
    >
      {/* View Title & Item Count */}
      <div className="flex items-center space-x-2.5">
        <h3 id="media-grid-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
          {title}
        </h3>
        <span
          id="media-grid-count-badge"
          className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800"
        >
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Controls: View Layout Mode & Sorting Dropdown */}
      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        {/* Layout Switcher (Grid vs Movie Banner) */}
        {onViewLayoutChange && (
          <div className="flex items-center p-0.5 bg-neutral-900/90 border border-neutral-800 rounded-xl shadow-sm">
            <button
              type="button"
              onClick={() => onViewLayoutChange('grid')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewLayout === 'grid'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Standard Grid Card view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewLayoutChange('banner')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewLayout === 'banner'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="IMDb Movie Banner view"
              aria-label="Banner view"
            >
              <Film className="w-3.5 h-3.5 text-[#f5c518]" />
              <span>Banners</span>
            </button>
          </div>
        )}

        {/* Sorting Dropdown Control */}
        <div className="flex items-center space-x-2 bg-neutral-900/90 border border-neutral-800 rounded-xl px-2.5 py-1.5 shadow-sm hover:border-neutral-700 transition">
          <div className="flex items-center space-x-1.5 text-xs text-neutral-400">
            {getSortIcon()}
            <label
              htmlFor="media-sort-dropdown"
              className="text-xs font-medium text-neutral-400 whitespace-nowrap cursor-pointer"
            >
              Sort by:
            </label>
          </div>

          <div className="relative inline-block">
            <select
              id="media-sort-dropdown"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as MediaSortOption)}
              className="appearance-none bg-neutral-800 hover:bg-neutral-750 text-neutral-100 text-xs font-semibold rounded-lg pl-2.5 pr-7 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer transition border border-neutral-700/60"
              aria-label="Sort media items"
            >
              <option value="recently_added">Recently Added</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="release_year">Release Year</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {onToggleSortOrder && (
            <button
              id="media-sort-order-toggle-btn"
              type="button"
              onClick={onToggleSortOrder}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition text-[11px] font-mono uppercase tracking-wider"
              title={`Switch order: currently ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              aria-label="Toggle sort direction"
            >
              <span className="sr-only">Toggle sort direction</span>
              <span className="px-1 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 font-semibold">
                {sortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
