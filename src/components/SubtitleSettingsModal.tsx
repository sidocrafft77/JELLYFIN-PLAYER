import React, { useRef, useState } from 'react';
import { SubtitleSettings, SubtitleTrack } from '../types';
import { parseSubtitleText } from '../services/subtitleParser';
import { Upload, X, Sliders, Type, AlignVerticalJustifyCenter, RefreshCw, FileText, Check, Plus, Tv } from 'lucide-react';

interface SubtitleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: SubtitleTrack[];
  selectedTrackId?: string;
  onSelectTrack: (trackId?: string) => void;
  onAddCustomTrack: (track: SubtitleTrack) => void;
  settings: SubtitleSettings;
  onUpdateSettings: (newSettings: Partial<SubtitleSettings>) => void;
}

export const SubtitleSettingsModal: React.FC<SubtitleSettingsModalProps> = ({
  isOpen,
  onClose,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onAddCustomTrack,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'tracks' | 'sync' | 'style' | 'playback'>('tracks');
  const [isDragging, setIsDragging] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [pastedLabel, setPastedLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    // Guard against accidentally loading huge binary files (e.g. video files instead of subtitles)
    if (file.size > 10 * 1024 * 1024) {
      console.warn('Subtitle file exceeds 10MB limit:', file.name);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const format = file.name.endsWith('.vtt') ? 'vtt' : 'srt';
      const cues = parseSubtitleText(content, file.name);

      const newTrack: SubtitleTrack = {
        id: `custom-file-${Date.now()}`,
        label: file.name.replace(/\.[^/.]+$/, ''),
        language: 'Custom',
        source: 'file',
        format,
        rawText: content,
        cues,
      };

      onAddCustomTrack(newTrack);
      onSelectTrack(newTrack.id);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      console.error('Error reading subtitle file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handlePastedSubmit = () => {
    if (!pastedContent.trim()) return;
    const label = pastedLabel.trim() || `Custom Subtitle ${tracks.length + 1}`;
    const cues = parseSubtitleText(pastedContent);

    const newTrack: SubtitleTrack = {
      id: `custom-paste-${Date.now()}`,
      label,
      language: 'Custom',
      source: 'custom',
      format: pastedContent.includes('WEBVTT') ? 'vtt' : 'srt',
      rawText: pastedContent,
      cues,
    };

    onAddCustomTrack(newTrack);
    onSelectTrack(newTrack.id);
    setPasteModalOpen(false);
    setPastedContent('');
    setPastedLabel('');
  };

  const adjustOffset = (amount: number) => {
    const current = settings.offsetSeconds || 0;
    const updated = Math.round((current + amount) * 10) / 10;
    onUpdateSettings({ offsetSeconds: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold tracking-tight">Subtitle Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/40">
          <button
            onClick={() => setActiveTab('tracks')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'tracks'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tracks ({tracks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'sync'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Timing Sync {settings.offsetSeconds !== 0 && `(${settings.offsetSeconds > 0 ? '+' : ''}${settings.offsetSeconds}s)`}</span>
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'style'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Appearance</span>
          </button>
          <button
            onClick={() => setActiveTab('playback')}
            className={`flex items-center space-x-2 py-3 px-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'playback'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Playback & Series</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: TRACKS */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-medium text-neutral-400 tracking-wider">
                  Available Subtitle Tracks
                </span>
                <button
                  onClick={() => setPasteModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Paste Text/URL</span>
                </button>
              </div>

              {/* Subtitle track list */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                <button
                  onClick={() => onSelectTrack(undefined)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-left transition ${
                    !selectedTrackId
                      ? 'bg-indigo-600/15 border-indigo-500 text-white font-medium'
                      : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <span>Off (No subtitles)</span>
                  {!selectedTrackId && <Check className="w-4 h-4 text-indigo-400" />}
                </button>

                {tracks.map((track) => {
                  const isSelected = selectedTrackId === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => onSelectTrack(track.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm text-left transition ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500 text-white font-medium'
                          : 'bg-neutral-800/60 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <span className="truncate">{track.label}</span>
                        {track.source === 'file' && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Custom File
                          </span>
                        )}
                        {track.source === 'custom' && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            Pasted
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10'
                    : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/40 hover:bg-neutral-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  accept=".srt,.vtt,.sub,.ass,.txt"
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 rounded-full bg-neutral-800 text-indigo-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-neutral-200">
                    Upload custom subtitle file
                  </div>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    Drag and drop your <code className="text-neutral-300">.srt</code>,{' '}
                    <code className="text-neutral-300">.vtt</code>, or{' '}
                    <code className="text-neutral-300">.sub</code> file here or browse
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIMING SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-neutral-200 mb-1">
                  Audio & Video Synchronization
                </h3>
                <p className="text-xs text-neutral-400">
                  Adjust subtitle timing delay if dialogue appears too early or too late.
                </p>
              </div>

              {/* Big Offset Display */}
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4 text-center">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">
                  Active Offset
                </span>
                <div className="text-3xl font-mono font-bold text-indigo-400">
                  {settings.offsetSeconds > 0 ? `+${settings.offsetSeconds.toFixed(1)}s` : `${settings.offsetSeconds.toFixed(1)}s`}
                </div>
                <span className="text-xs text-neutral-500 mt-1 block">
                  {settings.offsetSeconds === 0
                    ? 'In sync with default media timestamps'
                    : settings.offsetSeconds > 0
                    ? `Subtitles delayed by ${settings.offsetSeconds.toFixed(1)} seconds`
                    : `Subtitles appear ${Math.abs(settings.offsetSeconds).toFixed(1)}s earlier`}
                </span>
              </div>

              {/* Step Buttons */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-neutral-400">Quick Adjustments</span>
                <div className="grid grid-cols-5 gap-2">
                  <button
                    onClick={() => adjustOffset(-1.0)}
                    className="py-2 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
                  >
                    -1.0s
                  </button>
                  <button
                    onClick={() => adjustOffset(-0.2)}
                    className="py-2 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
                  >
                    -0.2s
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ offsetSeconds: 0 })}
                    className="py-2 px-2 rounded-lg bg-indigo-600/30 border border-indigo-500/50 hover:bg-indigo-600/40 text-xs font-medium text-indigo-200 transition"
                  >
                    Reset (0s)
                  </button>
                  <button
                    onClick={() => adjustOffset(+0.2)}
                    className="py-2 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
                  >
                    +0.2s
                  </button>
                  <button
                    onClick={() => adjustOffset(+1.0)}
                    className="py-2 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
                  >
                    +1.0s
                  </button>
                </div>
              </div>

              {/* Fine Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Earlier (-10s)</span>
                  <span>Later (+10s)</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={settings.offsetSeconds}
                  onChange={(e) => onUpdateSettings({ offsetSeconds: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-neutral-800 h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: STYLE & APPEARANCE */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              {/* Font Size */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-300 font-medium">Font Size</span>
                  <span className="text-neutral-400 text-xs">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="40"
                  step="2"
                  value={settings.fontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500 bg-neutral-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Text Color Picker */}
              <div className="space-y-2">
                <span className="text-sm text-neutral-300 font-medium block">Text Color</span>
                <div className="flex items-center space-x-2">
                  {[
                    { label: 'White', color: '#FFFFFF' },
                    { label: 'Yellow', color: '#FACC15' },
                    { label: 'Cyan', color: '#38BDF8' },
                    { label: 'Green', color: '#4ADE80' },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => onUpdateSettings({ textColor: preset.color })}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                        settings.textColor.toLowerCase() === preset.color.toLowerCase()
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/30"
                        style={{ backgroundColor: preset.color }}
                      />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => onUpdateSettings({ textColor: e.target.value })}
                    className="w-8 h-8 rounded border border-neutral-700 bg-neutral-900 cursor-pointer p-0.5"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Background Opacity */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-300 font-medium">Background Opacity</span>
                  <span className="text-neutral-400 text-xs">
                    {Math.round(settings.backgroundOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.backgroundOpacity}
                  onChange={(e) => onUpdateSettings({ backgroundOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-neutral-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Position & Outline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-sm text-neutral-300 font-medium block">Position</span>
                  <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                    {(['top', 'middle', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => onUpdateSettings({ position: pos })}
                        className={`py-1.5 text-xs capitalize rounded-lg transition ${
                          settings.position === pos
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-neutral-300 font-medium block">Text Outline</span>
                  <button
                    onClick={() => onUpdateSettings({ hasOutline: !settings.hasOutline })}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                      settings.hasOutline
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>High Contrast Shadow</span>
                    <span className={settings.hasOutline ? 'text-indigo-400' : 'text-neutral-500'}>
                      {settings.hasOutline ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="pt-2">
                <span className="text-xs uppercase font-medium text-neutral-400 tracking-wider block mb-2">
                  Live Style Preview
                </span>
                <div className="relative h-28 w-full rounded-xl overflow-hidden bg-gradient-to-tr from-slate-900 via-neutral-900 to-indigo-950 border border-neutral-800 flex items-center justify-center p-4">
                  <div
                    className="text-center rounded px-3 py-1 font-semibold max-w-[90%]"
                    style={{
                      fontSize: `${Math.min(26, settings.fontSize)}px`,
                      color: settings.textColor,
                      backgroundColor:
                        settings.backgroundOpacity > 0
                          ? `rgba(0, 0, 0, ${settings.backgroundOpacity})`
                          : 'transparent',
                      textShadow: settings.hasOutline
                        ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                        : '0 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    Sample subtitle text on video
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLAYBACK & SERIES */}
          {activeTab === 'playback' && (
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase font-medium text-neutral-400 tracking-wider block mb-1">
                  Series Playback Settings
                </span>
                <p className="text-xs text-neutral-400">
                  Configure episode queue automation and continuous playback options.
                </p>
              </div>

              {/* Play Next Episode Global Toggle Card */}
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Play Next Episode</span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          settings.playNextEpisode !== false
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {settings.playNextEpisode !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      Automatically start a countdown and play the next episode in a series when the current episode reaches the end.
                    </p>
                  </div>

                  {/* Accessible Toggle Button */}
                  <button
                    type="button"
                    role="switch"
                    id="play-next-episode-toggle"
                    aria-checked={settings.playNextEpisode !== false}
                    onClick={() => {
                      const nextVal = settings.playNextEpisode === false ? true : false;
                      onUpdateSettings({ playNextEpisode: nextVal });
                    }}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 ${
                      settings.playNextEpisode !== false ? 'bg-indigo-600' : 'bg-neutral-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        settings.playNextEpisode !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Applies to TV series, multi-part videos, and demo shows</span>
                  </span>
                  <span className="font-mono text-[11px] text-indigo-300">Global Setting</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-lg shadow-indigo-500/20"
          >
            Done
          </button>
        </div>

      </div>

      {/* Direct Paste Subtitle Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Paste Subtitle Content (SRT / VTT)</h3>
            <p className="text-xs text-neutral-400">
              Paste raw subtitle text or WebVTT content directly into the box below:
            </p>
            <input
              type="text"
              placeholder="Track Label (e.g. Director Commentary, Fan Subtitles)"
              value={pastedLabel}
              onChange={(e) => setPastedLabel(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              rows={8}
              placeholder={`1\n00:00:01,000 --> 00:00:04,000\nYour subtitle dialogue line here`}
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              className="w-full font-mono text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 text-sm rounded-xl text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handlePastedSubmit}
                disabled={!pastedContent.trim()}
                className="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition"
              >
                Add Subtitle Track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
