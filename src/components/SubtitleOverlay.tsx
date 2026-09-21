import React, { useMemo, useRef } from 'react';
import { SubtitleCue, SubtitleSettings } from '../types';
import { getActiveCueText } from '../services/subtitleParser';

interface SubtitleOverlayProps {
  cues?: SubtitleCue[];
  currentTime: number;
  settings: SubtitleSettings;
  isVisible: boolean;
}

// Hex to rgba helper with memo-friendly scope
const hexToRgba = (hex: string, alpha: number) => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SubtitleOverlayComponent: React.FC<SubtitleOverlayProps> = ({
  cues,
  currentTime,
  settings,
  isVisible,
}) => {
  const lastIndexRef = useRef<number>(-1);

  // Retrieve active cue text using O(1) sequential cache or O(log N) binary search
  const activeText = useMemo(() => {
    if (!isVisible || !cues || cues.length === 0) {
      return null;
    }
    return getActiveCueText(cues, currentTime, settings.offsetSeconds, lastIndexRef);
  }, [cues, currentTime, settings.offsetSeconds, isVisible]);

  // Memoize style definitions so style objects and string templates aren't rebuilt on every frame
  const { positionClasses, textContainerStyle } = useMemo(() => {
    const posClass = {
      bottom: 'bottom-16 sm:bottom-20',
      middle: 'top-1/2 -translate-y-1/2',
      top: 'top-16 sm:top-20',
    }[settings.position] || 'bottom-16 sm:bottom-20';

    const bgStyle = settings.backgroundOpacity > 0
      ? { backgroundColor: hexToRgba(settings.backgroundColor || '#000000', settings.backgroundOpacity) }
      : {};

    const textShadowStyle = settings.hasOutline
      ? {
          textShadow: `
            -1.5px -1.5px 0 ${settings.outlineColor},
             1.5px -1.5px 0 ${settings.outlineColor},
            -1.5px  1.5px 0 ${settings.outlineColor},
             1.5px  1.5px 0 ${settings.outlineColor},
             0 2px 4px rgba(0, 0, 0, 0.8)
          `,
        }
      : {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.9)',
        };

    return {
      positionClasses: posClass,
      textContainerStyle: {
        fontSize: `${settings.fontSize}px`,
        color: settings.textColor,
        fontFamily: settings.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
        lineHeight: settings.lineHeight || 1.35,
        fontWeight: 600,
        ...bgStyle,
        ...textShadowStyle,
      },
    };
  }, [
    settings.position,
    settings.backgroundOpacity,
    settings.backgroundColor,
    settings.hasOutline,
    settings.outlineColor,
    settings.fontSize,
    settings.textColor,
    settings.fontFamily,
    settings.lineHeight,
  ]);

  // Memoize lines splitting so we don't allocate arrays when subtitle text hasn't changed
  const lines = useMemo(() => {
    return activeText ? activeText.split('\n') : [];
  }, [activeText]);

  if (!isVisible || !cues || cues.length === 0 || !activeText) {
    return null;
  }

  return (
    <div
      className={`absolute left-0 right-0 pointer-events-none flex justify-center z-30 px-6 transition-all duration-150 ${positionClasses}`}
      aria-live="polite"
    >
      <div
        className="max-w-[85%] text-center rounded-md px-3 py-1.5 backdrop-blur-[2px] transition-all"
        style={textContainerStyle}
      >
        {lines.map((line, idx) => (
          <div key={idx} className="leading-tight">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SubtitleOverlay = React.memo(SubtitleOverlayComponent);
