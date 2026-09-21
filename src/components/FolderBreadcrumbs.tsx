import React from 'react';
import { FolderBreadcrumb } from '../types';
import {
  Home,
  ChevronRight,
  ArrowLeft,
  Folder,
  Film,
  Tv,
  Disc,
  FolderTree,
} from 'lucide-react';

interface FolderBreadcrumbsProps {
  breadcrumbs: FolderBreadcrumb[];
  onNavigate: (index: number) => void;
  onNavigateHome: () => void;
  onNavigateBack: () => void;
  currentFolderItem?: {
    name: string;
    overview?: string;
    type?: string;
    childCount?: number;
    backdropImageUrl?: string;
  } | null;
}

export const FolderBreadcrumbs: React.FC<FolderBreadcrumbsProps> = ({
  breadcrumbs,
  onNavigate,
  onNavigateHome,
  onNavigateBack,
  currentFolderItem,
}) => {
  const getBreadcrumbIcon = (type?: string, collectionType?: string) => {
    const t = (type || '').toLowerCase();
    const ct = (collectionType || '').toLowerCase();
    if (ct === 'movies' || t === 'movies') {
      return <Film className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (ct === 'tvshows' || t === 'series') {
      return <Tv className="w-3.5 h-3.5 text-indigo-400" />;
    }
    if (t === 'season') {
      return <Disc className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <Folder className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const isAtRoot = breadcrumbs.length === 0;

  return (
    <div className="space-y-3">
      {/* Breadcrumb Trail Bar */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center flex-wrap gap-2 px-3 py-2 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 text-xs"
      >
        {/* Back Button (only shown when inside subfolders) */}
        {!isAtRoot && (
          <button
            onClick={onNavigateBack}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium transition"
            title="Go up one folder"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Up</span>
          </button>
        )}

        {/* Home / Root Node */}
        <button
          onClick={onNavigateHome}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl transition font-medium ${
            isAtRoot
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
          title="All Jellyfin Libraries"
        >
          <Home className="w-3.5 h-3.5" />
          <span>All Libraries</span>
        </button>

        {/* Dynamic Breadcrumbs */}
        {breadcrumbs.map((crumb, index) => {
          const isCurrent = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id || index}>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
              <button
                onClick={() => onNavigate(index)}
                disabled={isCurrent}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl transition font-medium truncate max-w-[200px] ${
                  isCurrent
                    ? 'bg-indigo-600/25 border border-indigo-500/40 text-indigo-300 font-semibold cursor-default'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                }`}
                title={crumb.name}
              >
                {getBreadcrumbIcon(crumb.type, crumb.collectionType)}
                <span className="truncate">{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Active Folder Spotlight Header (when inside a folder) */}
      {!isAtRoot && currentFolderItem && (
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {currentFolderItem.backdropImageUrl && (
            <div
              className="absolute inset-0 opacity-20 bg-cover bg-center filter blur-md pointer-events-none"
              style={{ backgroundImage: `url(${currentFolderItem.backdropImageUrl})` }}
            />
          )}

          <div className="relative z-10 space-y-1 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-semibold flex items-center gap-1">
                <FolderTree className="w-3 h-3" />
                {currentFolderItem.type || 'Folder'}
              </span>
              {currentFolderItem.childCount !== undefined && (
                <span className="text-[11px] text-neutral-400 font-medium">
                  • {currentFolderItem.childCount} items inside
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {currentFolderItem.name}
            </h2>
            {currentFolderItem.overview && (
              <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed max-w-xl">
                {currentFolderItem.overview}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
