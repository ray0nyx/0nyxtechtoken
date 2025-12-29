import express from 'express';
import cors from 'cors';
import { Turnkey } from '@turnkey/sdk-server';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Turnkey client
// Note: TURNKEY_API_SECRET is the PUBLIC key, TURNKEY_API_KEY is the PRIVATE key
const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.TURNKEY_API_URL || 'https://api.turnkey.com',
    apiPublicKey: process.env.TURNKEY_API_SECRET,  // This is actually the public key
    apiPrivateKey: process.env.TURNKEY_API_KEY,    // This is actually the private key
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Turnkey Wallet Service',
        configured: !!(
            process.env.TURNKEY_API_KEY &&
            process.env.TURNKEY_API_SECRET &&
            process.env.TURNKEY_ORGANIZATION_ID
        ),
    });
});

// Create sub-organization with wallet
app.post('/api/turnkey/create-wallet', async (req, res) => {
    try {
        const { userId, userEmail } = req.body;

        if (!userId || !userEmail) {
            return res.status(400).json({
                error: 'Missing required fields: userId and userEmail',
            });
        }

        console.log('🔑 Creating Turnkey wallet for:', userEmail);

        // Create sub-organization with a Solana wallet
        const result = await turnkeyClient.apiClient().createSubOrganization({
            subOrganizationName: `Axiom-User-${userId}`,
            rootUsers: [
                {
                    userName: userEmail,
                    userEmail: userEmail,
                    apiKeys: [],
                    authenticators: [],
                    oauthProviders: [],
                },
            ],
            rootQuorumThreshold: 1,
            wallet: {
                walletName: `Wallet-${userId}`,
                accounts: [
                    {
                        curve: 'CURVE_ED25519',
                        pathFormat: 'PATH_FORMAT_BIP32',
                        path: "m/44'/501'/0'/0'",
                        addressFormat: 'ADDRESS_FORMAT_SOLANA',
                    },
                ],
            },
        });

        console.log('✅ Wallet created successfully');

        // Extract wallet info from response
        const walletId = (result.wallet && result.wallet.walletId) || '';
        const walletAddress = (result.wallet && result.wallet.addresses && result.wallet.addresses[0]) || '';
        res.json({
            subOrganizationId: result.subOrganizationId,
            subOrganizationName: `Axiom-User-${userId}`,
            walletId,
            walletAddress,
        });
    } catch (error) {
        console.error('❌ Error creating wallet:', error);
        res.status(500).json({
            error: error.message || 'Failed to create wallet',
            details: String(error),
        });
    }
});

// Get wallet information (proxy to avoid CORS)
app.get('/api/turnkey/get-wallet/:walletId', async (req, res) => {
    try {
        const { walletId } = req.params;
        const { organizationId } = req.query;

        if (!walletId) {
            return res.status(400).json({
                error: 'Missing required parameter: walletId',
            });
        }

        console.log('📋 Getting wallet info:', walletId);

        // Use the sub-organization ID if provided, otherwise use parent org
        const orgId = organizationId || process.env.TURNKEY_ORGANIZATION_ID;

        // Get wallet accounts (this returns the actual addresses)
        const result = await turnkeyClient.apiClient().getWalletAccounts({
            walletId,
            organizationId: orgId,
        });

        console.log('✅ Wallet accounts retrieved:', JSON.stringify(result, null, 2));

        // Find the Solana address
        const accounts = result.accounts || [];
        const solanaAccount = accounts.find(acc => acc.addressFormat === 'ADDRESS_FORMAT_SOLANA');
        const address = solanaAccount?.address || (accounts[0]?.address || '');

        res.json({
            walletId,
            organizationId: orgId,
            address,
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('❌ Error getting wallet:', error);
        res.status(500).json({
            error: error.message || 'Failed to get wallet',
            details: String(error),
        });
    }
});

const PORT = process.env.TURNKEY_PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Turnkey service running on http://localhost:${PORT}`);
    console.log(`   Configured: ${!!(
        process.env.TURNKEY_API_KEY &&
        process.env.TURNKEY_API_SECRET &&
        process.env.TURNKEY_ORGANIZATION_ID
    )}`);
});
