/**
 * IPFS Utility functions
 * Used to resolve IPFS URIs to HTTP gateway URLs
 */

// List of public IPFS gateways to try
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cf-ipfs.com/ipfs/' // Moved to end as it's currently failing DNS resolution
];

/**
 * Resolves an IPFS URI or gateway URL to a reliable HTTP URL
 * Handles:
 * - ipfs://<cid>
 * - https://ipfs.io/ipfs/<cid>
 * - <cid> directly (if valid CID format - simplistic check)
 */
export function resolveIpfsUrl(url: string | undefined): string {
    if (!url) return '';

    try {
        // 1. Handle "ipfs://" protocol
        if (url.startsWith('ipfs://')) {
            const cid = url.replace('ipfs://', '');
            return `${IPFS_GATEWAYS[0]}${cid}`;
        }

        // 2. Handle existing IPFS gateway URLs (replace with our preferred gateway if needed)
        // Many Pump.fun images come as https://cf-ipfs.com/ipfs/<cid> which is usually good,
        // but ipfs.io can be slow/rate-limited.
        if (url.includes('/ipfs/')) {
            // Extract CID part after /ipfs/
            const parts = url.split('/ipfs/');
            if (parts.length > 1) {
                const cid = parts[1];
                // Use Pinata or CF-IPFS as they are generally faster/more reliable for images
                return `${IPFS_GATEWAYS[2]}${cid}`; // Using cf-ipfs.com as default for replacement
            }
        }

        // 3. Handle raw CIDs (Qm... or baf...)
        // If it doesn't start with http/https/ipfs but looks like a CID
        if (!url.startsWith('http') && (url.startsWith('Qm') || url.startsWith('baf'))) {
            return `${IPFS_GATEWAYS[2]}${url}`; // Use CF-IPFS for raw CIDs
        }

        // 4. Return original URL if it's already a standard HTTP URL
        return url;
    } catch (e) {
        console.warn('Error resolving IPFS URL:', e);
        return url || '';
    }
}

/**
 * Wraps an image URL with our backend proxy to avoid CORS issues
 */
export function proxyImageUrl(url: string | undefined): string {
    if (!url) return '';

    // If it's already a data URI or a local blob, don't proxy
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    // If it's already a proxied URL, don't proxy again
    if (url.includes('/api/proxy/image?url=')) return url;

    // Resolve IPFS if needed first
    const resolvedUrl = resolveIpfsUrl(url);

    // Use backend proxy
    return `${apiUrl}/api/proxy/image?url=${encodeURIComponent(resolvedUrl)}`;
}
