'use client';

import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { COLOR_PALETTE, COLOR_NAMES } from '@x-place/shared';
import type { ColorIndex } from '@x-place/shared';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function BottomToolbar() {
  const { selectedColor, setSelectedColor, cooldownEnd } = useUIStore();
  const { isAuthenticated, user } = useAuthStore();
  const isSpectator = user?.isSpectatorOnly ?? false;

  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Cooldown countdown
  useEffect(() => {
    if (!cooldownEnd) {
      setCooldownRemaining(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setCooldownRemaining(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 100);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const colorEntries = Object.entries(COLOR_PALETTE) as [string, string][];
  const isOnCooldown = cooldownRemaining > 0;
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000);
  const cooldownProgress = cooldownEnd
    ? Math.min(100, ((5000 - cooldownRemaining) / 5000) * 100)
    : 100;

  // Can place pixel: authenticated, not spectator, not on cooldown
  const canPlace = isAuthenticated && !isSpectator && !isOnCooldown;

  // Calculate dasharray for progress circle
  const dasharray = `${cooldownProgress * 0.88} 88`;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-neutral-800 shadow-2xl">
        {/* Color Palette - 2 rows of 8 */}
        <div className="px-4 pt-4 pb-3">
          <div className="grid grid-cols-8 gap-1.5">
            {colorEntries.map(([index, hex]) => {
              const colorIndex = parseInt(index) as ColorIndex;
              const isSelected = selectedColor === colorIndex;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedColor(colorIndex)}
                  className={cn(
                    'w-8 h-8 rounded-lg transition-all duration-150',
                    'hover:scale-110 hover:z-10',
                    'focus:outline-none focus:ring-2 focus:ring-white/30',
                    isSelected && 'ring-2 ring-white scale-110 z-10 shadow-lg'
                  )}
                  style={{ backgroundColor: hex }}
                  title={COLOR_NAMES[colorIndex]}
                />
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-800 mx-4" />

        {/* Bottom row: Status + Action */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          {/* Selected color preview */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md ring-1 ring-white/20"
              style={{ backgroundColor: COLOR_PALETTE[selectedColor] }}
            />
            <span className="text-sm text-neutral-400">
              {COLOR_NAMES[selectedColor]}
            </span>
          </div>

          {/* Action area */}
          <div className="flex items-center gap-3">
            {/* Cooldown indicator */}
            {isOnCooldown && (
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  {/* Background circle */}
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-neutral-700"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={dasharray}
                      className="text-sky-500 transition-all duration-100"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {cooldownSeconds}
                  </span>
                </div>
              </div>
            )}

            {/* Place button or status */}
            {!isAuthenticated ? (
              <span className="text-sm text-neutral-500">Login to place pixels</span>
            ) : isSpectator ? (
              <span className="text-sm text-amber-500">Spectator mode</span>
            ) : (
              <div className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                canPlace
                  ? 'bg-sky-600 text-white'
                  : 'bg-neutral-800 text-neutral-500'
              )}>
                {isOnCooldown ? 'Wait...' : 'Click canvas to place'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
