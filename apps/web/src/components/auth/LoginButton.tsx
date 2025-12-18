'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface LoginButtonProps {
  className?: string;
  compact?: boolean;
}

/**
 * Login/Logout button with magic link email auth
 * Shows user profile when authenticated
 */
export function LoginButton({ className, compact }: LoginButtonProps) {
  const { isAuthenticated, isLoading, user, loginWithEmail, logout } = useAuth();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    setMessage(null);

    try {
      await loginWithEmail(email.trim());
      setMessage('Check your email for the magic link!');
      setEmail('');
    } catch {
      setMessage('Failed to send magic link. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'animate-pulse bg-neutral-800 rounded-lg',
          compact ? 'h-8 w-20' : 'h-10 w-32',
          className
        )}
      />
    );
  }

  // Authenticated state - show user profile and logout
  if (isAuthenticated && user) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {!compact && (
          <span className="text-sm text-neutral-300 max-w-[150px] truncate">
            {user.xUsername !== 'unknown' ? `@${user.xUsername}` : user.userId.slice(0, 8)}
          </span>
        )}
        <button
          onClick={logout}
          className={cn(
            'bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors',
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          )}
        >
          Logout
        </button>
      </div>
    );
  }

  // Show email input form
  if (showEmailInput) {
    return (
      <form onSubmit={handleSubmit} className={cn('flex items-center gap-2', className)}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={cn(
            'bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500',
            'focus:outline-none focus:ring-1 focus:ring-sky-500',
            compact ? 'px-2 py-1 text-xs w-32' : 'px-3 py-1.5 text-sm w-40'
          )}
          disabled={isSending}
          autoFocus
        />
        <button
          type="submit"
          disabled={isSending || !email.trim()}
          className={cn(
            'bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 text-white rounded-lg transition-colors',
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          )}
        >
          {isSending ? '...' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowEmailInput(false);
            setMessage(null);
          }}
          className="text-neutral-500 hover:text-neutral-300 text-sm"
        >
          ✕
        </button>
        {message && (
          <span className={cn(
            'text-xs',
            message.includes('Check') ? 'text-green-400' : 'text-red-400'
          )}>
            {message}
          </span>
        )}
      </form>
    );
  }

  // Not authenticated - show login button
  return (
    <button
      onClick={() => setShowEmailInput(true)}
      className={cn(
        'bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors',
        'flex items-center gap-2',
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        className
      )}
    >
      {compact ? 'Login' : 'Login with Email'}
    </button>
  );
}
