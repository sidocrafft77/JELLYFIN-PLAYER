import React, { useState } from 'react';
import { VideoResolutionTier } from '../types';
import {
  NetworkHealthInfo,
  RESOLUTION_PRESETS,
} from '../services/adaptiveResolution';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Gauge,
  Info,
  Signal,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';

interface ResolutionMenuProps {
  selectedResolution: VideoResolutionTier;
  effectiveResolution: Exclude<VideoResolutionTier, 'auto'>;
  onSelectResolution: (tier: VideoResolutionTier) => void;
  onClose: () => void;
  networkInfo: NetworkHealthInfo;
  bufferAheadSeconds: number;
  nativeVideoSize: { width: number; height: number };
  droppedFrames: number;
  totalFrames: number;
  isOfflinePlayback?: boolean;
}

export const ResolutionMenu: React.FC<ResolutionMenuProps> = ({
  selectedResolution,
  effectiveResolution,
  onSelectResolution,
  onClose,
  networkInfo,
  bufferAheadSeconds,
  nativeVideoSize,
  droppedFrames,
  totalFrames,
  isOfflinePlayback,
}) => {
  const [showTechnicalStats, setShowTechnicalStats] = useState(false);

  // Available options
  const resolutionKeys: VideoResolutionTier[] = [
    'auto',
    '1080p',
    '720p',
    '480p',
    '360p',
    'original',
  ];

  // Buffer health color indicator
  const getBufferColor = () => {
    if (bufferAheadSeconds >= 12) return 'text-emerald-400 bg-emerald-500/20';
    if (bufferAheadSeconds >= 4) return 'text-amber-400 bg-amber-500/20';
    return 'text-rose-400 bg-rose-500/20';
  };

  return (
    <div
      id="video-resolution-popover"
      className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:absolute sm:bottom-12 sm:right-0 w-auto sm:w-84 max-h-[82vh] bg-neutral-900/98 sm:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl shadow-2xl p-3 z-50 text-xs flex flex-col space-y-2.5 animate-fadeIn overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Video Resolution</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {selectedResolution === 'auto' && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Adaptive</span>
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Notice */}
      {isOfflinePlayback ? (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
          <p className="font-medium">Offline Playback Active</p>
          <p className="text-neutral-400 mt-0.5">
            Streaming from local storage at original downloaded quality. Adaptive transcoding is unavailable offline.
          </p>
        </div>
      ) : (
        /* Real-time Diagnostics Bar */
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-[10px]">
          <div className="flex flex-col">
            <span className="text-neutral-500 uppercase tracking-wider font-mono text-[9px] flex items-center space-x-1">
              <Wifi className="w-2.5 h-2.5" />
              <span>Speed</span>
            </span>
            <span className="font-semibold text-neutral-200 mt-0.5">
              {networkInfo.downlinkMbps
                ? `${networkInfo.downlinkMbps} Mbps`
                : networkInfo.effectiveType
                ? networkInfo.effectiveType.toUpperCase()
                : 'Broadband'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-neutral-500 uppercase tracking-wider font-mono text-[9px] flex items-center space-x-1">
              <Activity className="w-2.5 h-2.5" />
              <span>Buffer</span>
            </span>
            <span className={`font-semibold mt-0.5 px-1 py-0.2 rounded w-fit ${getBufferColor()}`}>
              +{bufferAheadSeconds.toFixed(1)}s
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-neutral-500 uppercase tracking-wider font-mono text-[9px] flex items-center space-x-1">
              <Signal className="w-2.5 h-2.5" />
              <span>Stream</span>
            </span>
            <span className="font-semibold text-indigo-300 mt-0.5">
              {nativeVideoSize.height ? `${nativeVideoSize.height}p` : 'Auto'}
            </span>
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-1">
        {resolutionKeys.map((tier) => {
          const preset = RESOLUTION_PRESETS[tier];
          const isSelected = selectedResolution === tier;
          const isCurrentlyPlaying =
            isSelected || (selectedResolution === 'auto' && tier === effectiveResolution);

          return (
            <button
              key={tier}
              id={`resolution-option-${tier}`}
              type="button"
              disabled={isOfflinePlayback && tier !== 'original'}
              onClick={() => {
                onSelectResolution(tier);
                onClose();
              }}
              className={`w-full text-left p-2 rounded-xl transition-all duration-150 flex items-center justify-between group ${
                isSelected
                  ? 'bg-indigo-600/25 border border-indigo-500/50 text-white'
                  : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white border border-transparent'
              } ${isOfflinePlayback && tier !== 'original' ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold text-xs ${isSelected ? 'text-indigo-200' : 'text-neutral-200'}`}>
                    {preset.label}
                  </span>
                  {preset.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                        tier === 'auto'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isSelected
                          ? 'bg-indigo-500/30 text-indigo-200'
                          : 'bg-neutral-800 text-neutral-400 group-hover:text-neutral-300'
                      }`}
                    >
                      {preset.badge}
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                  {tier === 'auto' ? (
                    <span className="text-emerald-400/90 font-medium">
                      Currently: {RESOLUTION_PRESETS[effectiveResolution]?.shortLabel} (
                      {RESOLUTION_PRESETS[effectiveResolution]?.badge || ''})
                    </span>
                  ) : (
                    preset.description
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Technical Diagnostics / Stats for Nerds Drawer */}
      <div className="pt-1.5 border-t border-neutral-800">
        <button
          onClick={() => setShowTechnicalStats(!showTechnicalStats)}
          className="w-full text-left py-1 px-1 rounded-lg text-neutral-400 hover:text-neutral-200 flex items-center justify-between text-[11px] transition"
        >
          <div className="flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-neutral-500" />
            <span>Technical Stream Details</span>
          </div>
          {showTechnicalStats ? (
            <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          )}
        </button>

        {showTechnicalStats && (
          <div className="mt-1.5 p-2 rounded-xl bg-neutral-950/80 border border-neutral-800/80 font-mono text-[10px] text-neutral-400 space-y-1 animate-fadeIn">
            <div className="flex justify-between">
              <span className="text-neutral-500">Rendered Resolution:</span>
              <span className="text-neutral-200">
                {nativeVideoSize.width && nativeVideoSize.height
                  ? `${nativeVideoSize.width} × ${nativeVideoSize.height}`
                  : 'Awaiting metadata'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Effective Quality:</span>
              <span className="text-indigo-300 font-semibold">{effectiveResolution}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Target Bitrate:</span>
              <span className="text-neutral-200">
                {RESOLUTION_PRESETS[effectiveResolution]?.videoBitRate
                  ? `${(RESOLUTION_PRESETS[effectiveResolution].videoBitRate! / 1000000).toFixed(1)} Mbps`
                  : 'Variable / Direct'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Buffer Ahead:</span>
              <span className="text-neutral-200">{bufferAheadSeconds.toFixed(2)} seconds</span>
            </div>
            {totalFrames > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Dropped Frames:</span>
                <span className={droppedFrames > 0 ? 'text-amber-400' : 'text-neutral-200'}>
                  {droppedFrames} / {totalFrames} (
                  {((droppedFrames / totalFrames) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-500">Codec / Format:</span>
              <span className="text-neutral-200">H.264 / AAC (MP4)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
