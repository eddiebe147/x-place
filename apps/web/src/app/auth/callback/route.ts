/**
 * OAuth callback route for X (Twitter) authentication
 * Handles the PKCE flow redirect from Supabase Auth
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedis } from '@/lib/redis/client';
import { nanoid } from 'nanoid';
import { MIN_ACCOUNT_AGE_DAYS, COOLDOWNS } from '@x-place/shared';
import type { UserSession } from '@x-place/shared';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();

    // Exchange the OAuth code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Extract X (Twitter) user metadata from the OAuth response
      const xMetadata = data.user.user_metadata;

      // Get X account creation date for Sybil defense
      // Twitter API provides this in user_metadata.created_at
      const xAccountCreatedAt = xMetadata?.created_at as string | undefined;

      // Calculate account age in days
      let accountAgeDays = 365; // Default to old enough if we can't determine
      if (xAccountCreatedAt) {
        const createdDate = new Date(xAccountCreatedAt);
        const now = new Date();
        accountAgeDays = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // Sybil defense: accounts less than 30 days old are spectator-only
      const isSpectatorOnly = accountAgeDays < MIN_ACCOUNT_AGE_DAYS;

      // Check if user is verified (blue checkmark)
      const isVerified = xMetadata?.verified === true;

      // Determine cooldown based on verification status
      const cooldownSeconds = isSpectatorOnly
        ? 0 // Spectators can't place anyway
        : isVerified
          ? COOLDOWNS.VERIFIED_MS / 1000
          : COOLDOWNS.NORMAL_MS / 1000;

      // Generate a unique session token for WebSocket authentication
      const sessionToken = nanoid(32);

      // Build the UserSession object
      const session: UserSession = {
        userId: data.user.id,
        xUserId: xMetadata?.provider_id || xMetadata?.sub || '',
        xUsername:
          xMetadata?.user_name ||
          xMetadata?.preferred_username ||
          xMetadata?.name ||
          'unknown',
        xDisplayName: xMetadata?.full_name || xMetadata?.name || null,
        xProfileImageUrl:
          xMetadata?.avatar_url || xMetadata?.picture || null,
        factionId: null, // User hasn't joined a faction yet
        isVerified,
        isSpectatorOnly,
        cooldownSeconds,
        createdAt: new Date().toISOString(),
      };

      // Store session in Redis with 24-hour TTL
      const redis = getRedis();
      await redis.set(`xplace:session:${sessionToken}`, JSON.stringify(session), {
        ex: 86400, // 24 hours
      });

      console.log(
        `[Auth] User ${session.xUsername} authenticated (verified: ${isVerified}, spectator: ${isSpectatorOnly})`
      );

      // Create response with redirect to home
      const response = NextResponse.redirect(`${origin}${next}`);

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
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
