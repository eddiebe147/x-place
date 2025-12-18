'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';
import { useUIStore } from '@/stores/ui-store';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { usePanZoom } from '@/hooks/usePanZoom';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ColorIndex } from '@x-place/shared';
import { cn } from '@/lib/utils';

interface PixelCanvasProps {
  onPlacePixel?: (x: number, y: number, color: ColorIndex) => void;
}

export function PixelCanvas({ onPlacePixel }: PixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { colorIndices, updatePixel, isLoading } = useCanvasStore();
  const {
    selectedColor,
    setCoordinates,
    setHoveredPixel,
    setCooldown,
    cooldownEnd,
  } = useUIStore();

  const { canvasRef, renderInitialState, queuePixelUpdate } = useCanvasRenderer({
    onReady: () => console.log('Canvas renderer ready'),
  });

  const { viewport, getCanvasCoords, isDragging } = usePanZoom({
    containerRef,
    onCoordinateChange: (x, y) => {
      setCoordinates(x, y);
      setHoveredPixel({ x, y });
    },
  });

  // Render initial canvas state when color indices are available
  useEffect(() => {
    if (colorIndices) {
      renderInitialState(colorIndices);
    }
  }, [colorIndices, renderInitialState]);

  // Initialize with demo canvas (white background)
  useEffect(() => {
    // For now, create a demo canvas with all white pixels
    const demoIndices = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
    demoIndices.fill(0); // Color 0 = white

    // Add some random pixels for visual interest
    for (let i = 0; i < 1000; i++) {
      const x = Math.floor(Math.random() * CANVAS_WIDTH);
      const y = Math.floor(Math.random() * CANVAS_HEIGHT);
      const color = Math.floor(Math.random() * 16);
      demoIndices[y * CANVAS_WIDTH + x] = color;
    }

    // Convert packed bitfield to base64 without spread operator (avoids stack overflow)
    const packed = packBitfield(demoIndices);
    let binary = '';
    for (let i = 0; i < packed.length; i++) {
      binary += String.fromCharCode(packed[i]);
    }
    useCanvasStore.getState().initializeCanvas(btoa(binary));
  }, []);

  // Handle pixel placement
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      if (cooldownEnd && Date.now() < cooldownEnd) return;

      const coords = getCanvasCoords(e.clientX, e.clientY);

      // Update local state immediately (optimistic)
      updatePixel(coords.x, coords.y, selectedColor);
      queuePixelUpdate({ x: coords.x, y: coords.y, color: selectedColor });

      // Send to server via WebSocket
      if (onPlacePixel) {
        onPlacePixel(coords.x, coords.y, selectedColor);
      }

      // Set cooldown (5 seconds for demo)
      setCooldown(Date.now() + 5000);

      console.log(`Placed pixel at (${coords.x}, ${coords.y}) with color ${selectedColor}`);
    },
    [
      isDragging,
      cooldownEnd,
      getCanvasCoords,
      selectedColor,
      updatePixel,
      queuePixelUpdate,
      setCooldown,
      onPlacePixel,
    ]
  );

  // Canvas transform style
  const transformStyle = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden bg-neutral-900 canvas-container',
        isDragging ? 'cursor-grabbing' : 'cursor-crosshair'
      )}
      onClick={handleClick}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-neutral-400">Loading canvas...</span>
          </div>
        </div>
      )}

      {/* Canvas container with transforms */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={transformStyle}
      >
        <canvas
          ref={canvasRef}
          className="image-rendering-pixelated shadow-2xl"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* Grid overlay at high zoom */}
      {viewport.zoom >= 10 && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={transformStyle}
        >
          <div
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '1px 1px',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Pack color indices into 4-bit bitfield
 */
function packBitfield(indices: Uint8Array): Uint8Array {
  const packed = new Uint8Array(Math.ceil(indices.length / 2));
  for (let i = 0; i < packed.length; i++) {
    const high = indices[i * 2] || 0;
    const low = indices[i * 2 + 1] || 0;
    packed[i] = ((high & 0x0f) << 4) | (low & 0x0f);
  }
  return packed;
}
