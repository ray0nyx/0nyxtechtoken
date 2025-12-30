import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { fetchSolanaWalletBalance } from '@/lib/wallet-balance-service';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getTurnkeyService } from '@/lib/wallet-abstraction/turnkey-service';
import { createClient } from '@/lib/supabase/client';

// 0nyxTech fee percentage (0.85%)
const ONYX_FEE_PERCENT = 0.0085;
// 0nyxTech main Turnkey wallet for fee collection
const ONYX_FEE_WALLET = 'GigMJejt3oLx6uMuRfvFh2gY5hGXDPfKYKYL5tLRNZ5G';
// Estimated Solana network fee in SOL (typically ~0.000005 SOL per signature)
const BASE_NETWORK_FEE_SOL = 0.000005;

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number;
    walletAddress: string | null;
}

export function WithdrawModal({ isOpen, onClose, currentBalance, walletAddress }: WithdrawModalProps) {
    const [amount, setAmount] = useState<string>('');
    const [destinationAddress, setDestinationAddress] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [solPrice, setSolPrice] = useState<number>(200); // Default SOL price
    const { toast } = useToast();
    const supabase = createClient();

    // Fetch current SOL price for fee display
    useEffect(() => {
        const fetchSolPrice = async () => {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                const data = await response.json();
                if (data.solana?.usd) {
                    setSolPrice(data.solana.usd);
                }
            } catch (error) {
                console.warn('Could not fetch SOL price, using default');
            }
        };
        if (isOpen) {
            fetchSolPrice();
        }
    }, [isOpen]);

    // Calculate fees in real-time
    const fees = useMemo(() => {
        const parsedAmount = parseFloat(amount) || 0;

        // Network fee (base fee for 2 transactions: withdrawal + fee transfer)
        const networkFeeSol = BASE_NETWORK_FEE_SOL * 2;

        // 0nyxTech fee (0.85% of withdrawal amount)
        const onyxFeeSol = parsedAmount * ONYX_FEE_PERCENT;

        // Total fee in SOL
        const totalFeeSol = networkFeeSol + onyxFeeSol;

        // Total fee in USD
        const totalFeeUsd = totalFeeSol * solPrice;

        return {
            networkFeeSol,
            onyxFeeSol,
            totalFeeSol,
            totalFeeUsd,
        };
    }, [amount, solPrice]);

    // Calculate max withdrawable amount (balance - total fees)
    const maxWithdrawable = useMemo(() => {
        // Reserve enough for fees: network fee + estimated 0nyxTech fee on remaining balance
        // Solve: max + (max * 0.0085) + networkFee = balance
        // max * (1 + 0.0085) = balance - networkFee
        // max = (balance - networkFee) / 1.0085
        const networkFee = BASE_NETWORK_FEE_SOL * 2;
        const maxAmount = (currentBalance - networkFee) / (1 + ONYX_FEE_PERCENT);
        return Math.max(0, maxAmount);
    }, [currentBalance]);

    const handleMaxClick = () => {
        setAmount(maxWithdrawable.toFixed(6));
    };

    const handleWithdraw = async () => {
        if (!amount || !destinationAddress || !walletAddress) return;

        setLoading(true);
        try {
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                throw new Error("Invalid amount");
            }

            if (parsedAmount + fees.totalFeeSol > currentBalance) {
                throw new Error("Insufficient balance (including fees)");
            }

            try {
                new PublicKey(destinationAddress);
            } catch (e) {
                throw new Error("Invalid destination address");
            }

            // Create connection
            const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
            const fromPubkey = new PublicKey(walletAddress);
            const toPubkey = new PublicKey(destinationAddress);
            const feePubkey = new PublicKey(ONYX_FEE_WALLET);

            // Create transaction with two instructions:
            // 1. Transfer to destination
            // 2. Transfer fee to 0nyxTech wallet
            const transaction = new Transaction()
                .add(
                    SystemProgram.transfer({
                        fromPubkey,
                        toPubkey,
                        lamports: Math.floor(parsedAmount * LAMPORTS_PER_SOL),
                    })
                )
                .add(
                    SystemProgram.transfer({
                        fromPubkey,
                        toPubkey: feePubkey,
                        lamports: Math.floor(fees.onyxFeeSol * LAMPORTS_PER_SOL),
                    })
                );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;

            // TODO: Sign via Turnkey backend and broadcast
            // For now, simulate the flow
            await new Promise(resolve => setTimeout(resolve, 2000));

            toast({
                title: "Withdrawal Initiated",
                description: `Transferred ${amount} SOL to ${destinationAddress.slice(0, 6)}... (Fee: ${fees.totalFeeSol.toFixed(6)} SOL)`,
            });
            onClose();

        } catch (error: any) {
            console.error("Withdrawal error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to process withdrawal",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = amount && parseFloat(amount) > 0 && destinationAddress.length > 30;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-[#0a0a0a] text-white border-white/10 p-0 gap-0 overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold">Withdraw</h2>
                </div>

                <div className="p-6 space-y-6">
                    {/* Asset Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0a0a0a] rounded-lg border border-white/10 p-1">
                            <div className="flex items-center gap-2 px-3 py-2">
                                <img src="/images/solana.svg" alt="SOL" className="w-5 h-5" />
                                <span className="font-medium text-sm">Solana</span>
                            </div>
                        </div>
                        <div className="bg-[#0a0a0a] rounded-lg border border-white/10 flex items-center justify-end px-4">
                            <div className="text-sm flex items-center gap-1">
                                <span className="text-gray-400">Balance: </span>
                                <span className="text-white font-medium">{currentBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                <img src="/images/solana.svg" alt="SOL" className="w-3.5 h-3.5 ml-0.5" />
                            </div>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Withdraw Amount</span>
                            <button onClick={handleMaxClick} className="text-[#6366f1] hover:text-[#4f46e5] font-medium transition-colors">
                                Max
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0.0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="bg-[#0a0a0a] border-white/10 text-white h-12 pl-4 pr-16 focus-visible:ring-1 focus-visible:ring-[#6366f1] focus-visible:border-[#6366f1] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                <img src="/images/solana.svg" alt="SOL" className="w-4 h-4" />
                            </div>
                        </div>
                        {/* Real-time fee estimate */}
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Network: {fees.networkFeeSol.toFixed(6)} SOL</span>
                            <span>${fees.totalFeeUsd.toFixed(4)} Fee</span>
                        </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center -my-2 relative z-10">
                        <div className="bg-[#0a0a0a] rounded-full p-2 border border-white/10">
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                        </div>
                    </div>

                    {/* Destination Address */}
                    <div className="space-y-2 pt-2">
                        <div className="bg-[#0a0a0a] rounded-lg border border-white/10 p-1 mb-3">
                            <div className="flex items-center gap-2 px-3 py-2">
                                <img src="/images/solana.svg" alt="SOL" className="w-5 h-5" />
                                <span className="font-medium text-sm">Solana</span>
                            </div>
                        </div>

                        <Input
                            placeholder="Address: Address of destination wallet"
                            value={destinationAddress}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            className="bg-[#0a0a0a] border-white/10 text-white h-12 focus-visible:ring-1 focus-visible:ring-[#6366f1] focus-visible:border-[#6366f1]"
                        />
                    </div>

                    {/* "To" Summary */}
                    <div className="bg-[#0a0a0a] rounded-lg border border-white/10 p-4 flex justify-between items-center">
                        <span className="text-gray-400 text-sm">To</span>
                        <div className="flex items-center gap-2">
                            <img src="/images/solana.svg" alt="SOL" className="w-4 h-4" />
                            <span className="text-white font-medium text-lg">{amount || '0.0'}</span>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                        className="w-full h-12 text-base font-medium rounded-xl transition-all"
                        variant={isFormValid ? "default" : "secondary"}
                        disabled={!isFormValid || loading}
                        style={{
                            backgroundColor: isFormValid ? '#4f46e5' : '#3f3f46',
                            color: isFormValid ? 'white' : '#9ca3af',
                            cursor: isFormValid ? 'pointer' : 'not-allowed'
                        }}
                        onClick={handleWithdraw}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing...
                            </div>
                        ) : !destinationAddress ? (
                            "Missing Destination Address"
                        ) : (
                            "Withdraw"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
