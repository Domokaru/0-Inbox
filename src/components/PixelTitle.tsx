import React, { useId } from 'react';

interface PixelTitleProps {
  zeroColor?: string;
  inboxColor?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
}

const CYAN_ZERO_PATH = `
  M1 0 h3 v1 h-3 Z 
  M0 1 h1 v1 h-1 Z M4 1 h1 v1 h-1 Z 
  M0 2 h1 v1 h-1 Z M3 2 h2 v1 h-2 Z 
  M0 3 h1 v1 h-1 Z M2 3 h1 v1 h-1 Z M4 3 h1 v1 h-1 Z 
  M0 4 h2 v1 h-2 Z M4 4 h1 v1 h-1 Z 
  M0 5 h1 v1 h-1 Z M4 5 h1 v1 h-1 Z 
  M1 6 h3 v1 h-3 Z
`;

const MAGENTA_INBOX_PATH = `
  M8 0 h3 v1 h-3 Z M9 1 h1 v5 h-1 Z M8 6 h3 v1 h-3 Z 
  M13 0 h1 v7 h-1 Z M17 0 h1 v7 h-1 Z M14 1 h1 v2 h-1 Z M15 3 h1 v2 h-1 Z M16 5 h1 v1 h-1 Z 
  M20 0 h1 v7 h-1 Z M21 0 h3 v1 h-3 Z M21 3 h3 v1 h-3 Z M21 6 h3 v1 h-3 Z M24 1 h1 v2 h-1 Z M24 4 h1 v2 h-1 Z 
  M28 0 h3 v1 h-3 Z M28 6 h3 v1 h-3 Z M27 1 h1 v5 h-1 Z M31 1 h1 v5 h-1 Z 
  M34 0 h1 v2 h-1 Z M38 0 h1 v2 h-1 Z M35 2 h1 v1 h-1 Z M37 2 h1 v1 h-1 Z M36 3 h1 v1 h-1 Z M35 4 h1 v1 h-1 Z M37 4 h1 v1 h-1 Z M34 5 h1 v2 h-1 Z M38 5 h1 v2 h-1 Z
`;

/**
 * 0 INBOX title with custom SVG pixel-art vector typography,
 * a truly transparent background, and a very light pulsing glow.
 */
export default function PixelTitle({
  zeroColor = '#00ffff',
  inboxColor = '#ff00ff',
  className = '',
  width = 220,
  height = 70,
}: PixelTitleProps) {
  return (
    <div
      className={`inline-flex items-center justify-center select-none bg-transparent ${className}`}
      style={{
        background: 'transparent',
        backgroundColor: 'transparent',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 450 150"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'block',
          overflow: 'visible',
          background: 'transparent',
          backgroundColor: 'transparent',
        }}
      >
        <g transform="translate(30, 40) scale(10)" style={{ background: 'transparent' }}>
          {/* Gentle, light pulsing glow layer using CSS filters to avoid SVG sRGB artifact boxes */}
          <g opacity="0.65" className="animate-pulse">
            <path
              fill={zeroColor}
              d={CYAN_ZERO_PATH}
              style={{ filter: `drop-shadow(0px 0px 5px ${zeroColor})` }}
            />
            <path
              fill={inboxColor}
              d={MAGENTA_INBOX_PATH}
              style={{ filter: `drop-shadow(0px 0px 5px ${inboxColor})` }}
            />
          </g>

          {/* Crisp foreground vector art with true transparency */}
          <path
            fill={zeroColor}
            d={CYAN_ZERO_PATH}
          />
          <path
            fill={inboxColor}
            d={MAGENTA_INBOX_PATH}
          />
        </g>
      </svg>
    </div>
  );
}
