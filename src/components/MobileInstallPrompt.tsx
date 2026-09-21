import React, { useEffect, useState } from 'react';
import { Smartphone, Download, X, Share2, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const MobileInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('jellyfin_pwa_prompt_dismissed') === 'true';
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (isStandalone || isDismissed) {
    return null;
  }

  // Only show on mobile or when install prompt is available
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('jellyfin_pwa_prompt_dismissed', 'true');
  };

  return (
    <div
      id="mobile-install-banner"
      className="md:hidden mx-4 mb-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border border-indigo-500/40 text-white shadow-lg backdrop-blur-md relative animate-fadeIn transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-400/30 flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Install Jellyfin App</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 text-[9px] font-mono uppercase">
                PWA
              </span>
            </h4>
            <p className="text-[11px] text-neutral-300 truncate">
              {isIOS ? 'Add to Home Screen for fullscreen & offline playback' : 'Install for quick home screen access & offline player'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <button
            id="mobile-install-cta-btn"
            type="button"
            onClick={handleInstallClick}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/40 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            id="mobile-install-dismiss-btn"
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
            aria-label="Dismiss app install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari step-by-step guidance modal */}
      {showIOSGuide && (
        <div className="mt-2.5 pt-2.5 border-t border-indigo-800/50 text-xs space-y-1.5 text-neutral-200">
          <div className="flex items-start space-x-2">
            <span className="font-bold text-indigo-300">1.</span>
            <span className="flex items-center gap-1">
              Tap the Safari <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-indigo-400" /> at bottom of screen.
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-indigo-300">2.</span>
            <span className="flex items-center gap-1">
              Scroll down and select <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-indigo-400" />.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
