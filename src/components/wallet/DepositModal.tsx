import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, X } from "lucide-react";
import { getTurnkeyService } from '@/lib/wallet-abstraction/turnkey-service';
import { createClient } from '@/lib/supabase/client';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { fetchSolanaWalletBalance } from '@/lib/wallet-balance-service';
import { getCurrentUser } from '@/lib/auth-utils';

interface DepositModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function DepositModal({ isOpen, onOpenChange, trigger }: DepositModalProps) {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState("deposit");
    const [balance, setBalance] = useState<number>(0);
    const supabase = createClient();
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchOrCreateWallet();
        }
    }, [isOpen]);

    const fetchOrCreateWallet = async () => {
        setLoading(true);
        try {
            // Support both Supabase and SIWS wallet auth
            const authUser = await getCurrentUser();

            if (!authUser) {
                console.log('DepositModal: No authenticated user');
                setLoading(false);
                return;
            }

            const userId = authUser.id;
            const isWalletUser = authUser.isWalletUser;
            console.log('DepositModal: Fetching wallet for user:', userId, 'isWalletUser:', isWalletUser);

            // Check for existing Turnkey wallet
            let existingWalletAddress: string | null = null;

            if (isWalletUser) {
                // Use wallet API for SIWS users
                const { getTurnkeyWalletViaAPI } = await import('@/lib/wallet-api');
                const result = await getTurnkeyWalletViaAPI(userId);
                if (result.wallet) {
                    existingWalletAddress = result.wallet.wallet_address;
                }
            } else {
                // Use direct Supabase for regular users
                const { data: existingWallets } = await supabase
                    .from('user_wallets')
                    .select('wallet_address')
                    .eq('user_id', userId)
                    .eq('wallet_type', 'turnkey')
                    .limit(1);

                if (existingWallets && existingWallets.length > 0) {
                    existingWalletAddress = existingWallets[0].wallet_address;
                }
            }

            if (existingWalletAddress) {
                console.log('DepositModal: Found existing Turnkey wallet:', existingWalletAddress);
                setWalletAddress(existingWalletAddress);
                setLoading(false);
                return;
            }

            // Create new wallet if none exists
            console.log('DepositModal: Creating new Turnkey wallet...');
            const turnkeyService = getTurnkeyService();
            const userEmail = authUser.email || (authUser.walletAddress
                ? `${authUser.walletAddress.substring(0, 8)}@wallet.0nyxtech.xyz`
                : `user-${userId.substring(0, 8)}@onyx.internal`);

            const subOrg = await turnkeyService.createSubOrganization(userId, userEmail);
            const newWalletAddress = subOrg.walletAddress;
            setWalletAddress(newWalletAddress);

            // Save to DB
            if (isWalletUser) {
                const { saveTurnkeyWalletViaAPI } = await import('@/lib/wallet-api');
                const result = await saveTurnkeyWalletViaAPI(
                    userId,
                    newWalletAddress,
                    subOrg.walletId,
                    subOrg.subOrganizationId,
                    'Main Wallet'
                );
                if (result.error) {
                    console.error("Failed to save wallet to DB:", result.error);
                }
            } else {
                const { error: saveError } = await supabase
                    .from('user_wallets')
                    .upsert({
                        user_id: userId,
                        wallet_address: newWalletAddress,
                        wallet_type: 'turnkey',
                        turnkey_wallet_id: subOrg.walletId,
                        turnkey_organization_id: subOrg.subOrganizationId,
                        created_at: new Date().toISOString(),
                        is_active: true,
                    });

                if (saveError) {
                    console.error("Failed to save wallet to DB:", saveError);
                }
            }

        } catch (error) {
            console.error("Error in fetchOrCreateWallet:", error);
            toast({
                title: "Error",
                description: "Failed to load wallet address. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (walletAddress) {
            const getBalance = async () => {
                try {
                    const walletData = await fetchSolanaWalletBalance(walletAddress);
                    const solBalance = walletData.balances['SOL']?.amount || 0;
                    setBalance(solBalance);
                } catch (error) {
                    console.error("Failed to fetch balance", error);
                }
            };
            getBalance();
            // Poll every 30 seconds
            const interval = setInterval(getBalance, 30000);
            return () => clearInterval(interval);
        }
    }, [walletAddress]);

    const copyToClipboard = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({
                title: "Copied!",
                description: "Wallet address copied to clipboard",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md bg-[#050505] text-white border-none p-0 overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold">Exchange</h2>
                    {/* Close button is handled by DialogContent usually, but we can add custom if needed */}
                </div>

                <Tabs defaultValue="deposit" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-4 pt-4">
                        <TabsList className="grid w-full grid-cols-3 bg-[#27272a] rounded-lg h-10 p-1">
                            <TabsTrigger
                                value="convert"
                                className="data-[state=active]:bg-[#3f3f46] data-[state=active]:text-white text-gray-400 rounded-md text-sm font-medium"
                            >
                                Convert
                            </TabsTrigger>
                            <TabsTrigger
                                value="deposit"
                                className="data-[state=active]:bg-[#3f3f46] data-[state=active]:text-white text-gray-400 rounded-md text-sm font-medium"
                            >
                                Deposit
                            </TabsTrigger>
                            <TabsTrigger
                                value="buy"
                                className="data-[state=active]:bg-[#3f3f46] data-[state=active]:text-white text-gray-400 rounded-md text-sm font-medium"
                            >
                                Buy
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6 space-y-6">
                        <TabsContent value="deposit" className="mt-0 space-y-6 focus-visible:ring-0">

                            <div className="flex gap-3">
                                <div className="flex-1 bg-[#27272a] rounded-lg p-3 border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <img src="/images/solana.svg" alt="Solana" className="w-5 h-5 rounded-full" />
                                        <span className="font-medium text-sm">Solana</span>
                                    </div>
                                </div>

                                <div className="flex-1 bg-[#27272a] rounded-lg p-3 border border-white/5 flex items-center justify-between">
                                    <span className="text-gray-400 text-sm">Balance:</span>
                                    <span className="font-medium text-sm">{balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} SOL</span>
                                </div>
                            </div>

                            <div className="text-sm text-gray-400">
                                Only deposit Solana through the Solana network for this address.
                            </div>

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
                                    <p className="text-sm text-gray-400">Loading wallet address...</p>
                                </div>
                            ) : walletAddress ? (
                                <div className="bg-[#121215] rounded-xl p-4 flex gap-4 border border-white/5">
                                    <div className="bg-white p-2 rounded-lg shrink-0">
                                        {/* QR Code */}
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&bgcolor=ffffff&data=${walletAddress}`}
                                            alt="Wallet Address QR"
                                            className="w-24 h-24 object-contain"
                                        />
                                    </div>

                                    <div className="flex flex-col justify-between flex-1 min-w-0">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">Deposit Address</div>
                                            <div className="text-sm text-gray-300 break-all font-mono leading-relaxed">
                                                {walletAddress}
                                            </div>
                                        </div>

                                        <div className="flex justify-end mt-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                                                onClick={copyToClipboard}
                                            >
                                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-red-400">
                                    Failed to load wallet address.
                                </div>
                            )}



                            <Button
                                className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-medium h-11 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                                onClick={copyToClipboard}
                                disabled={loading || !walletAddress}
                            >
                                {copied ? "Copied!" : "Copy Address"}
                            </Button>
                        </TabsContent>

                        <TabsContent value="convert">
                            <div className="py-12 text-center text-gray-500">Convert feature coming soon</div>
                        </TabsContent>

                        <TabsContent value="buy">
                            <div className="py-12 text-center text-gray-500">Buy feature coming soon</div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
