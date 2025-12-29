/**
 * Authentication Utilities
 * 
 * Helper functions for handling both Supabase and SIWS wallet authentication.
 */

import { createClient } from '@/lib/supabase/client';
import { getSIWSToken, getSIWSPublicKey } from '@/lib/solana/siws';

export interface AuthUser {
    id: string;
    email?: string | null;
    isWalletUser: boolean;
    walletAddress?: string | null;
}

/**
 * Get the current authenticated user from either Supabase or SIWS wallet auth.
 * Returns null if no authentication found.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    const supabase = createClient();

    // First, try to get Supabase user (email/Google auth)
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (user && !error) {
            return {
                id: user.id,
                email: user.email,
                isWalletUser: false,
                walletAddress: null,
            };
        }
    } catch (e) {
        // Supabase auth error, continue to check SIWS
        console.log('Supabase auth check failed, trying SIWS...');
    }

    // Second, check for SIWS wallet authentication
    const siwsToken = getSIWSToken();
    const siwsPublicKey = getSIWSPublicKey();

    if (siwsToken && siwsPublicKey) {
        try {
            let userId: string | null = null;

            // Check if token is a JWT (has 3 parts separated by dots)
            if (siwsToken.includes('.') && siwsToken.split('.').length === 3) {
                // Parse the user ID from the JWT token
                const payload = JSON.parse(atob(siwsToken.split('.')[1]));
                userId = payload.sub;
            } else if (siwsToken.startsWith('wallet_')) {
                // Handle placeholder token format: wallet_<userId>
                userId = siwsToken.replace('wallet_', '');
            }

            if (userId) {
                return {
                    id: userId,
                    email: null,
                    isWalletUser: true,
                    walletAddress: siwsPublicKey,
                };
            }
        } catch (e) {
            console.error('Failed to parse SIWS token:', e);
        }
    }

    // No authentication found
    return null;
}

/**
 * Get user ID for database queries.
 * Works with both Supabase and SIWS authentication.
 */
export async function getUserId(): Promise<string | null> {
    const user = await getCurrentUser();
    return user?.id || null;
}

/**
 * Check if the current user is authenticated (via any method).
 */
export async function isAuthenticated(): Promise<boolean> {
    const user = await getCurrentUser();
    return user !== null;
}
