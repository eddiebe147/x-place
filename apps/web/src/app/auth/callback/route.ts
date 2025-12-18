/**
 * OAuth/Magic Link callback route for authentication
 * Handles both OAuth code exchange and magic link token verification
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedis } from '@/lib/redis/client';
import { nanoid } from 'nanoid';
import { COOLDOWNS } from '@x-place/shared';
import type { UserSession } from '@x-place/shared';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;
      const metadata = user.user_metadata || {};

      // Check if this is an X (Twitter) OAuth login
      const provider = user.app_metadata?.provider;
      const isXLogin = provider === 'twitter';

      // Generate a unique session token for WebSocket authentication
      const sessionToken = nanoid(32);

      // Build the UserSession object
      const session: UserSession = {
        userId: user.id,
        xUserId: isXLogin ? (metadata.provider_id || metadata.sub || '') : '',
        xUsername: isXLogin
          ? (metadata.user_name || metadata.preferred_username || metadata.name || 'unknown')
          : 'unknown',
        xDisplayName: isXLogin ? (metadata.full_name || metadata.name || null) : null,
        xProfileImageUrl: metadata.avatar_url || metadata.picture || null,
        factionId: null,
        isVerified: metadata.verified === true,
        isSpectatorOnly: false, // All authenticated users can place pixels
        cooldownSeconds: COOLDOWNS.NORMAL_MS / 1000,
        createdAt: new Date().toISOString(),
      };

      // Store session in Redis with 24-hour TTL
      const redis = getRedis();
      await redis.set(`xplace:session:${sessionToken}`, JSON.stringify(session), {
        ex: 86400, // 24 hours
      });

      const displayName = user.email || user.id.slice(0, 8);
      console.log('[Auth] User authenticated:', displayName, '(provider:', provider || 'email', ')');

      // Create response with redirect to home
      const response = NextResponse.redirect(origin + next);

      // Set session token cookie for client to read
      response.cookies.set('xplace_session_token', sessionToken, {
        httpOnly: false, // Client JS needs to read this for WebSocket auth
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
        path: '/',
      });

      return response;
    }

    // Auth failed - log the error
    console.error('[Auth] Failed to exchange code for session:', error);
  }

  // Redirect to error page or home with error param
  return NextResponse.redirect(origin + '/?error=auth_failed');
}
