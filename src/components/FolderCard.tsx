import React from 'react';
import { JellyfinItem } from '../types';
import {
  Folder,
  Film,
  Tv,
  Layers,
  ChevronRight,
  Disc,
  Video,
  Music,
  FolderTree,
} from 'lucide-react';

interface FolderCardProps {
  folder: JellyfinItem;
  onOpen: (folder: JellyfinItem) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder, onOpen }) => {
  // Determine appropriate icon and styling based on folder type or collection type
  const getFolderIcon = () => {
    const colType = (folder.collectionType || '').toLowerCase();
    const type = (folder.type || '').toLowerCase();

    if (colType === 'movies' || type === 'movies') {
      return <Film className="w-7 h-7 text-amber-400" />;
    }
    if (colType === 'tvshows' || type === 'series') {
      return <Tv className="w-7 h-7 text-indigo-400" />;
    }
    if (type === 'season') {
      return <Disc className="w-7 h-7 text-emerald-400" />;
    }
    if (colType === 'music') {
      return <Music className="w-7 h-7 text-rose-400" />;
    }
    if (colType === 'homevideos' || colType === 'photos') {
      return <Video className="w-7 h-7 text-cyan-400" />;
    }
    if (colType === 'boxsets') {
      return <Layers className="w-7 h-7 text-purple-400" />;
    }
    return <Folder className="w-7 h-7 text-indigo-400" />;
  };

  const getFolderTypeLabel = () => {
    const colType = (folder.collectionType || '').toLowerCase();
    const type = (folder.type || '').toLowerCase();

    if (type === 'collectionfolder' || type === 'userview') {
      if (colType === 'movies') return 'Movie Library';
      if (colType === 'tvshows') return 'TV Series Library';
      if (colType === 'homevideos') return 'Videos Library';
      return 'Library';
    }
    if (type === 'series') return 'TV Series';
    if (type === 'season') return `Season ${folder.parentIndexNumber ?? ''}`.trim();
    if (type === 'boxset') return 'Collection';
    return 'Folder';
  };

  const getItemCountString = () => {
    if (folder.childCount !== undefined && folder.childCount !== null) {
      if (folder.type === 'Series') {
        return `${folder.childCount} ${folder.childCount === 1 ? 'Season' : 'Seasons'}`;
      }
      if (folder.type === 'Season') {
        return `${folder.childCount} ${folder.childCount === 1 ? 'Episode' : 'Episodes'}`;
      }
      return `${folder.childCount} ${folder.childCount === 1 ? 'Item' : 'Items'}`;
    }
    if (folder.itemCounts) {
      const parts: string[] = [];
      if (folder.itemCounts.movieCount) parts.push(`${folder.itemCounts.movieCount} Movies`);
      if (folder.itemCounts.seriesCount) parts.push(`${folder.itemCounts.seriesCount} Series`);
      if (folder.itemCounts.episodeCount) parts.push(`${folder.itemCounts.episodeCount} Episodes`);
      if (folder.itemCounts.folderCount) parts.push(`${folder.itemCounts.folderCount} Folders`);
      if (parts.length > 0) return parts.join(' • ');
    }
    return 'Folder';
  };

  return (
    <div
      onClick={() => onOpen(folder)}
      className="group relative bg-neutral-900/90 border border-neutral-800 hover:border-indigo-500/70 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(folder);
        }
      }}
      aria-label={`Open folder ${folder.name}`}
    >
      {/* Visual Header / Cover Image Container */}
      <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden flex items-center justify-center">
        {folder.backdropImageUrl || folder.primaryImageUrl ? (
          <img
            src={folder.backdropImageUrl || folder.primaryImageUrl}
            alt={folder.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-90 group-hover:brightness-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 flex items-center justify-center">
            <div className="p-4 rounded-2xl bg-neutral-800/80 border border-neutral-700/50 transform group-hover:scale-110 transition duration-300 shadow-inner">
              {getFolderIcon()}
            </div>
          </div>
        )}

        {/* Gradient shadow for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

        {/* Top Left Icon Pill */}
        <div className="absolute top-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-neutral-700/60 shadow">
          {getFolderIcon()}
          <span className="text-[11px] font-semibold text-neutral-200">
            {getFolderTypeLabel()}
          </span>
        </div>

        {/* Top Right Item Count Pill */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-indigo-950/80 backdrop-blur-md border border-indigo-500/40 text-indigo-300 font-mono text-[11px] font-semibold shadow">
          {getItemCountString()}
        </div>

        {/* Hover open hint overlay */}
        <div className="absolute inset-0 bg-indigo-950/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-xl shadow-indigo-600/40 transform group-hover:scale-105 transition duration-200">
            <FolderTree className="w-4 h-4" />
            <span>Open Folder</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      </div>

      {/* Folder Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2 bg-neutral-900/60">
        <div>
          <h3
            className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1"
            title={folder.name}
          >
            {folder.name}
          </h3>

          {folder.overview ? (
            <p className="text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
              {folder.overview}
            </p>
          ) : (
            <p className="text-xs text-neutral-500 mt-1">
              Click to view contents and media files
            </p>
          )}
        </div>

        {/* Bottom indicator row */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80 text-xs text-neutral-400">
          <div className="flex items-center space-x-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-neutral-400 font-medium">Jellyfin Directory</span>
          </div>

          <span className="text-indigo-400 font-medium flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform text-[11px]">
            <span>Browse</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};
