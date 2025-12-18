'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, canPlacePixels } from '@/stores/auth-store';

/**
 * Hook for managing authentication with magic links
 */
export function useAuth() {
  const {
    user,
    sessionToken,
    isAuthenticated,
    isLoading,
    setUser,
    setSessionToken,
    setLoading,
    logout: storeLogout,
  } = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      // Check for session token in cookie
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('xplace_session_token='))
        ?.split('=')[1];

      if (token) {
        setSessionToken(token);

        // Fetch user data from session API
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setUser(data.user);
              console.log('[Auth] Session restored for user:', data.user.userId.slice(0, 8));
            } else {
              setLoading(false);
            }
          } else {
            // Invalid session - clear it
            setSessionToken(null);
            setLoading(false);
          }
        } catch (error) {
          console.error('[Auth] Failed to fetch session:', error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setSessionToken, setLoading]);

  // Login with magic link (email)
  const loginWithEmail = useCallback(async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('[Auth] Magic link error:', error);
      throw error;
    }
  }, []);

  // Legacy: Login with X (Twitter) - can be used for linking account later
  const loginWithX = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('[Auth] OAuth error:', error);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    // Sign out from Supabase
    const supabase = createClient();
    await supabase.auth.signOut();

    // Clear session token cookie
    document.cookie = 'xplace_session_token=; Max-Age=0; path=/';

    // Call logout API to clear Redis session
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('[Auth] Failed to logout from API:', error);
    }

    // Clear local state
    storeLogout();
    console.log('[Auth] User logged out');
  }, [storeLogout]);

  // Check if user can place pixels
  const userCanPlacePixels = canPlacePixels(useAuthStore.getState());

  return {
    user,
    sessionToken,
    isAuthenticated,
    isLoading,
    canPlacePixels: userCanPlacePixels,
    loginWithEmail,
    loginWithX,
    logout,
  };
}
