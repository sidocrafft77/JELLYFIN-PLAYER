import React, { useRef, useState } from 'react';
import { JellyfinItem } from '../types';
import { X, Play, Link, Upload, Video } from 'lucide-react';

interface DirectPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayDirect: (item: JellyfinItem, streamUrl: string) => void;
}

export const DirectPlayModal: React.FC<DirectPlayModalProps> = ({
  isOpen,
  onClose,
  onPlayDirect,
}) => {
  const [streamUrl, setStreamUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;

    const title = customTitle.trim() || 'Custom Video Stream';
    const item: JellyfinItem = {
      id: `stream-${Date.now()}`,
      name: title,
      type: 'Video',
      overview: 'Direct video stream URL',
    };

    onPlayDirect(item, streamUrl.trim());
    onClose();
  };

  const handleLocalFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const item: JellyfinItem = {
      id: `local-file-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      type: 'Video',
      overview: `Local video file (${Math.round(file.size / (1024 * 1024))} MB)`,
    };

    onPlayDirect(item, objectUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Open Custom Stream or File</h2>
              <p className="text-xs text-neutral-400">Play any direct video stream or local video with custom subtitles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Stream URL Form */}
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <span className="text-xs font-semibold uppercase text-neutral-400 tracking-wider block">
              Direct Stream URL (MP4 / WebM / HLS)
            </span>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Video Title (Optional)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex space-x-2">
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!streamUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition flex items-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          </form>

          <div className="flex items-center space-x-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-xs text-neutral-500 uppercase font-medium">or</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Local File Picker */}
          <div>
            <span className="text-xs font-semibold uppercase text-neutral-400 tracking-wider block mb-2">
              Open Local File from Computer
            </span>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,.mkv,.mp4,.webm"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleLocalFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-950/40 hover:bg-neutral-950/60 rounded-xl p-5 text-center transition flex flex-col items-center justify-center space-y-2 cursor-pointer"
            >
              <div className="p-2.5 rounded-full bg-neutral-800 text-indigo-400">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-neutral-200">
                Select local video file (.mp4, .webm, .mkv)
              </span>
              <span className="text-xs text-neutral-400">
                Play directly in the browser with our custom subtitle engine
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
