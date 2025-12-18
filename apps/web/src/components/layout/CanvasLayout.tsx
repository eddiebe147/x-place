'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { PixelCanvas } from '@/components/canvas/PixelCanvas';
import { ColorPalette } from '@/components/ui/ColorPalette';
import { CooldownTimer } from '@/components/ui/CooldownTimer';
import { CoordinateDisplay } from '@/components/canvas/CoordinateDisplay';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { cn } from '@/lib/utils';

export function CanvasLayout() {
  const { isMobileMode, setMobileMode, isSidebarOpen, toggleSidebar } = useUIStore();

  // Initialize WebSocket connection
  const { placePixel } = useWebSocket({
    onConnected: () => console.log('WebSocket connected!'),
    onDisconnected: () => console.log('WebSocket disconnected'),
    onError: (error) => console.error('WebSocket error:', error),
  });

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setMobileMode(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobileMode]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950">
      {/* Main canvas */}
      <PixelCanvas onPlacePixel={placePixel} />

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between pointer-events-none">
        <ConnectionStatus />
        <CoordinateDisplay />
      </div>

      {/* Desktop sidebar */}
      {!isMobileMode && (
        <aside
          className={cn(
            'absolute top-0 right-0 h-full w-72 bg-neutral-900/95 backdrop-blur-sm',
            'transform transition-transform duration-300 z-20',
            'flex flex-col gap-4 p-4 pt-16',
            'border-l border-neutral-800',
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <ColorPalette />
          <CooldownTimer />

          {/* Placeholder for future features */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-4 bg-neutral-800 rounded-lg">
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Faction Leaderboard</h3>
              <p className="text-xs text-neutral-500">Coming soon...</p>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile bottom sheet */}
      {isMobileMode && (
        <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-inset-bottom">
          <div className="bg-neutral-900/95 backdrop-blur-sm rounded-t-2xl p-4 border-t border-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <ColorPalette compact />
              <CooldownTimer compact />
            </div>
          </div>
        </div>
      )}

      {/* Sidebar toggle (desktop only) */}
      {!isMobileMode && (
        <button
          onClick={toggleSidebar}
          className={cn(
            'absolute top-4 z-30 p-2 bg-neutral-800 rounded-lg',
            'hover:bg-neutral-700 transition-colors pointer-events-auto',
            isSidebarOpen ? 'right-[304px]' : 'right-4'
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isSidebarOpen ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
            />
          </svg>
        </button>
      )}
    </div>
  );
}
