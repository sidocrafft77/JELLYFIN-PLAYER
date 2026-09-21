import React from 'react';
import { Tag, X, Sparkles, Filter } from 'lucide-react';

interface GenreFilterBarProps {
  genres: string[];
  genreCounts: Record<string, number>;
  selectedGenre: string | null;
  onSelectGenre: (genre: string | null) => void;
  totalCount: number;
}

export const GenreFilterBar: React.FC<GenreFilterBarProps> = ({
  genres,
  genreCounts,
  selectedGenre,
  onSelectGenre,
  totalCount,
}) => {
  if (genres.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-3 sm:p-4 space-y-2.5 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Label & Active Status */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center space-x-1.5 text-neutral-300 font-semibold">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span>Filter by Genre</span>
          </span>

          {selectedGenre && (
            <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium">
              <span>Showing: <strong>{selectedGenre}</strong> ({genreCounts[selectedGenre] || 0})</span>
              <button
                onClick={() => onSelectGenre(null)}
                className="hover:text-white transition p-0.5 rounded-full hover:bg-indigo-500/40 cursor-pointer"
                title="Clear genre filter"
                aria-label="Clear genre filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* Clear Filter Button if active */}
        {selectedGenre && (
          <button
            onClick={() => onSelectGenre(null)}
            className="flex items-center space-x-1 text-xs text-neutral-400 hover:text-white transition font-medium cursor-pointer"
          >
            <X className="w-3 h-3 text-neutral-500" />
            <span>Clear filter</span>
          </button>
        )}
      </div>

      {/* Genre Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-wrap sm:flex-nowrap">
        {/* All Genres Pill */}
        <button
          onClick={() => onSelectGenre(null)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
            selectedGenre === null
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40'
              : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span>All Genres</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedGenre === null ? 'bg-indigo-700/80 text-white' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Individual Genre Pills */}
        {genres.map((genre) => {
          const isSelected = selectedGenre === genre;
          const count = genreCounts[genre] || 0;

          return (
            <button
              key={genre}
              onClick={() => onSelectGenre(isSelected ? null : genre)}
              className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400/40'
                  : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700'
              }`}
              title={`Filter by ${genre} (${count} items)`}
            >
              <span>{genre}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-indigo-700/80 text-white' : 'bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700'
                }`}
              >
                {count}
              </span>
              {isSelected && <X className="w-3 h-3 ml-0.5 text-indigo-200 hover:text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
