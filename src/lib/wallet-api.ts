/**
 * Wallet API Service
 * 
 * Client-side service for wallet management via Edge Function.
 * Uses Edge Function to bypass RLS for SIWS wallet users.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface WalletManageResponse {
    success?: boolean;
    error?: string;
    wallet?: any;
    wallets?: any[];
    message?: string;
}

/**
 * Track a wallet in the wallet_tracking table
 */
export async function trackWalletViaAPI(
    userId: string,
    walletAddress: string,
    blockchain: 'solana' | 'bitcoin' = 'solana',
    label: string = 'Wallet'
): Promise<WalletManageResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'track_wallet',
                userId,
                walletAddress,
                blockchain,
                label,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Track wallet error:', data);
            return { error: data.error || 'Failed to track wallet' };
        }

        return data;
    } catch (error: any) {
        console.error('Track wallet error:', error);
        return { error: error.message || 'Network error' };
    }
}

/**
 * Save a Turnkey wallet to the user_wallets table
 */
export async function saveTurnkeyWalletViaAPI(
    userId: string,
    walletAddress: string,
    turnkeyWalletId: string,
    turnkeyOrgId: string,
    label: string = 'Main Wallet'
): Promise<WalletManageResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'save_turnkey_wallet',
                userId,
                walletAddress,
                turnkeyWalletId,
                turnkeyOrgId,
                label,
                walletType: 'turnkey',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Save Turnkey wallet error:', data);
            return { error: data.error || 'Failed to save wallet' };
        }

        return data;
    } catch (error: any) {
        console.error('Save Turnkey wallet error:', error);
        return { error: error.message || 'Network error' };
    }
}

/**
 * Get all tracked wallets for a user
 */
export async function getWalletsViaAPI(userId: string): Promise<WalletManageResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'get_wallets',
                userId,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Get wallets error:', data);
            return { error: data.error || 'Failed to get wallets' };
        }

        return data;
    } catch (error: any) {
        console.error('Get wallets error:', error);
        return { error: error.message || 'Network error' };
    }
}

/**
 * Get Turnkey wallet for a user
 */
export async function getTurnkeyWalletViaAPI(userId: string): Promise<WalletManageResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'get_turnkey_wallet',
                userId,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Get Turnkey wallet error:', data);
            return { error: data.error || 'Failed to get wallet' };
        }

        return data;
    } catch (error: any) {
        console.error('Get Turnkey wallet error:', error);
        return { error: error.message || 'Network error' };
    }
}

interface ProfileResponse {
    success?: boolean;
    error?: string;
    profile?: {
        id: string;
        username?: string;
        avatar_url?: string;
    };
}

/**
 * Save user profile for SIWS users
 */
export async function saveProfileViaAPI(
    userId: string,
    username?: string,
    avatarUrl?: string
): Promise<ProfileResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'save_profile',
                userId,
                username,
                avatarUrl,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Save profile error:', data);
            return { error: data.error || 'Failed to save profile' };
        }

        return data;
    } catch (error: any) {
        console.error('Save profile error:', error);
        return { error: error.message || 'Network error' };
    }
}

/**
 * Get user profile for SIWS users
 */
export async function getProfileViaAPI(userId: string): Promise<ProfileResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'get_profile',
                userId,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Get profile error:', data);
            return { error: data.error || 'Failed to get profile' };
        }

        return data;
    } catch (error: any) {
        console.error('Get profile error:', error);
        return { error: error.message || 'Network error' };
    }
}

interface DeleteAccountResponse {
    success?: boolean;
    error?: string;
    message?: string;
}

/**
 * Delete all user account data from the database
 */
export async function deleteAccountViaAPI(userId: string): Promise<DeleteAccountResponse> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-manage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'delete_account',
                userId,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Delete account error:', data);
            return { error: data.error || 'Failed to delete account' };
        }

        return data;
    } catch (error: any) {
        console.error('Delete account error:', error);
        return { error: error.message || 'Network error' };
    }
}
